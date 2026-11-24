import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { ConnectivityService } from './connectivity.service';

/**
 * What the app can say about the API.
 *
 * `waking` exists because Render (the API's host) spins the instance down when
 * it is idle: the first request after a nap answers 502/504, or nothing at all,
 * for up to a minute. That is not the same failure as a crashed service, and
 * showing "offline" for it would be technically true but alarmist.
 */
export type ApiState = 'checking' | 'online' | 'waking' | 'offline';

/** How long a single probe may take before it counts as a failure. */
const PROBE_TIMEOUT_MS = 8_000;
/** Normal poll cadence while the tab is visible. */
const POLL_INTERVAL_MS = 30_000;
/** Faster cadence while the API looks like it is still booting. */
const WAKING_RETRY_MS = 5_000;
/** How long a run of failures counts as "starting up" before it is called down. */
const WAKING_GRACE_MS = 60_000;
/** Minimum gap between traffic-triggered probes, so a burst cannot stampede. */
const MIN_PROBE_GAP_MS = 5_000;

/**
 * Tracks whether the API itself is reachable.
 *
 * This is deliberately NOT `navigator.onLine` (see `ConnectivityService`): that
 * only reports whether the device has a network, so it stays `true` while Render
 * is down, booting, or failing every request.
 *
 * The probe uses plain `fetch`, never `HttpClient`, for two reasons:
 * - `offlineInterceptor` serves GETs from the IndexedDB cache when the network
 *   fails, so an `HttpClient` probe would report "online" during an outage -
 *   the exact bug this exists to fix.
 * - It must not carry the bearer token (it would be attached by
 *   `authInterceptor`) nor appear in the request log.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiHealthService {
  private readonly connectivity = inject(ConnectivityService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stateSignal = signal<ApiState>('checking');

  /** Reactive API reachability, for templates and computed signals. */
  readonly state = this.stateSignal.asReadonly();

  private readonly lastCheckedSignal = signal<number | null>(null);

  /** Epoch ms of the last completed probe, or null before the first one. */
  readonly lastCheckedAt = this.lastCheckedSignal.asReadonly();

  /** True only when the API has answered since the last failure. */
  readonly online = computed(() => this.stateSignal() === 'online');

  /** True when the API is unreachable or still coming back up. */
  readonly degraded = computed(() => {
    const state = this.stateSignal();
    return state === 'waking' || state === 'offline';
  });

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<ApiState> | null = null;
  private lastProbeAt = 0;
  private failingSince: number | null = null;

  private readonly hasDom =
    typeof window !== 'undefined' && typeof document !== 'undefined';

  constructor() {
    if (this.hasDom) {
      window.addEventListener('online', this.onBrowserOnline);
      window.addEventListener('offline', this.onBrowserOffline);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.destroyRef.onDestroy(() => this.stop());
    }

    // Probe immediately: the indicator must never open on a stale assumption.
    void this.checkNow({ force: true });
  }

  /**
   * Probe the API now.
   *
   * Concurrent callers share one in-flight request. A traffic-triggered call
   * (`force: false`) is rate-limited, so a screen making twenty failing requests
   * still causes at most one probe every {@link MIN_PROBE_GAP_MS}.
   */
  async checkNow(options: { force?: boolean } = {}): Promise<ApiState> {
    if (this.inFlight) return this.inFlight;

    if (!options.force && Date.now() - this.lastProbeAt < MIN_PROBE_GAP_MS) {
      return this.stateSignal();
    }

    const request = this.probe();
    this.inFlight = request;

    try {
      return await request;
    } finally {
      this.inFlight = null;
      this.schedule();
    }
  }

  /** Called by the tap interceptor when a real request was answered. */
  reportSuccess(): void {
    if (this.stateSignal() === 'online') return;

    this.recordSuccess();
    this.schedule();
  }

  /**
   * Called by the tap interceptor when a request could not reach the API.
   *
   * Only a state *change* reschedules the poll - otherwise a page that keeps
   * failing would push the timer out forever and the probe would starve.
   */
  reportFailure(): void {
    if (this.inFlight) return;

    const before = this.stateSignal();
    this.recordFailure();

    if (before !== this.stateSignal()) this.schedule();
  }

  /** Drop the poll timer and the DOM listeners. Safe to call more than once. */
  stop(): void {
    this.clearPoll();

    if (!this.hasDom) return;

    window.removeEventListener('online', this.onBrowserOnline);
    window.removeEventListener('offline', this.onBrowserOffline);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private async probe(): Promise<ApiState> {
    if (!this.connectivity.isOnline()) {
      // No interface up at all - a request would only wait for its timeout.
      this.failingSince = Date.now();
      this.stateSignal.set('offline');
      this.lastCheckedSignal.set(Date.now());
      return 'offline';
    }

    this.lastProbeAt = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${environment.apiUrl}/health?cb=${Date.now()}`,
        {
          method: 'GET',
          // A cached 200 would keep the dot green after the API died, and the
          // query string alone is not enough: some intermediaries ignore it.
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }
      );

      // 5xx means the edge answered but the app did not: a cold start, a crashed
      // container, or a boot in progress. Everything else - 2xx, 401, even a 404
      // from an API that predates /health - proves the API is serving.
      if (response.status >= 500) return this.recordFailure();

      return this.recordSuccess();
    } catch {
      // Abort (timeout), DNS failure, TLS failure, connection reset.
      return this.recordFailure();
    } finally {
      clearTimeout(timeout);
      this.lastCheckedSignal.set(Date.now());
    }
  }

  private recordSuccess(): ApiState {
    this.failingSince = null;
    this.stateSignal.set('online');
    return 'online';
  }

  private recordFailure(): ApiState {
    const now = Date.now();

    // Remember when this run of failures started: a fresh run is "waking" for
    // its first minute, an old one is simply down.
    this.failingSince ??= now;
    const state: ApiState =
      now - this.failingSince >= WAKING_GRACE_MS ? 'offline' : 'waking';

    this.stateSignal.set(state);
    return state;
  }

  private schedule(): void {
    if (!this.hasDom) return;

    this.clearPoll();

    // A hidden tab has no one to show the result to; `visibilitychange` probes
    // as soon as it is back in front.
    if (document.hidden) return;

    const delay =
      this.stateSignal() === 'waking' ? WAKING_RETRY_MS : POLL_INTERVAL_MS;

    this.pollTimer = setTimeout(() => void this.checkNow({ force: true }), delay);
  }

  private clearPoll(): void {
    if (this.pollTimer === null) return;

    clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  private readonly onBrowserOnline = (): void => {
    void this.checkNow({ force: true });
  };

  private readonly onBrowserOffline = (): void => {
    // The interface is gone, so no probe can succeed. Report it without waiting
    // for a timeout, then keep the normal cadence so recovery is automatic.
    this.failingSince = Date.now();
    this.stateSignal.set('offline');
    this.schedule();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearPoll();
      return;
    }

    void this.checkNow({ force: true });
  };
}
