import { Injectable, signal } from '@angular/core';

/**
 * Tracks whether the browser currently has network connectivity.
 *
 * `navigator.onLine` is only a hint: it reports `true` whenever an interface is up,
 * so it can be `true` on a captive portal or a dead uplink. Treat it as a cheap
 * first gate - real network failures still have to be handled by the caller.
 */
@Injectable({
  providedIn: 'root',
})
export class ConnectivityService {
  private readonly onlineState = signal(this.readNavigatorOnline());

  /** Reactive connectivity state, for templates and computed signals. */
  readonly online = this.onlineState.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onlineState.set(true));
      window.addEventListener('offline', () => this.onlineState.set(false));
    }
  }

  /** Synchronous check for imperative callers such as an HTTP interceptor. */
  isOnline(): boolean {
    return this.readNavigatorOnline();
  }

  private readNavigatorOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }
}
