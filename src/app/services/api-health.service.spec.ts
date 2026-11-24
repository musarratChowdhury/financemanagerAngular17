import { TestBed } from '@angular/core/testing';
import { ApiHealthService } from './api-health.service';
import { ConnectivityService } from './connectivity.service';

/** The service only asks connectivity one question, so this is all it needs. */
class ConnectivityStub {
  up = true;

  isOnline(): boolean {
    return this.up;
  }
}

describe('ApiHealthService', () => {
  let service: ApiHealthService;
  let connectivity: ConnectivityStub;
  let fetchSpy: jasmine.Spy;

  /** Feed the next probe a plain HTTP status. */
  function respondWith(status: number): void {
    fetchSpy.and.callFake(async () => new Response(null, { status }));
  }

  /** Move the clock forward without waiting for real time. */
  function advance(ms: number): void {
    jasmine.clock().tick(ms);
  }

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-01-01T00:00:00Z'));

    connectivity = new ConnectivityStub();
    fetchSpy = spyOn(globalThis, 'fetch');

    TestBed.configureTestingModule({
      providers: [{ provide: ConnectivityService, useValue: connectivity }],
    });
  });

  afterEach(() => {
    service?.stop();
    jasmine.clock().uninstall();
  });

  /** Create the service and settle the probe its constructor fires. */
  async function create(initialStatus = 200): Promise<void> {
    respondWith(initialStatus);
    service = TestBed.inject(ApiHealthService);
    await service.checkNow({ force: true });
    fetchSpy.calls.reset();
  }

  it('reports online when /health answers 200', async () => {
    await create(200);

    expect(service.state()).toBe('online');
    expect(service.online()).toBe(true);
    expect(service.lastCheckedAt()).not.toBeNull();
  });

  it('probes the health endpoint with cache-busting and no credentials', async () => {
    await create(200);

    // `create` cleared the spy, so this forced probe is call #1.
    await service.checkNow({ force: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toContain('/health?cb=');
    expect(init.cache).toBe('no-store');
    expect(init.method).toBe('GET');
    expect(JSON.stringify(init.headers)).not.toContain('Authorization');
  });

  it('treats a 404 as reachable - the API may predate /health', async () => {
    await create(404);

    expect(service.state()).toBe('online');
  });

  it('treats a 401 as reachable: the server answered, the token is the problem', async () => {
    await create(401);

    expect(service.state()).toBe('online');
  });

  it('reports "waking" while failures are still fresh', async () => {
    await create(200);

    respondWith(503);
    await service.checkNow({ force: true });

    expect(service.state()).toBe('waking');
    expect(service.online()).toBe(false);
    expect(service.degraded()).toBe(true);
  });

  it('escalates to offline only after the grace window', async () => {
    await create(200);

    respondWith(503);
    await service.checkNow({ force: true });
    expect(service.state()).toBe('waking');

    // 61s of continuous failure - past the 60s cold-start allowance.
    jasmine.clock().mockDate(new Date(Date.now() + 61_000));
    await service.checkNow({ force: true });

    expect(service.state()).toBe('offline');
  });

  it('recovers to online as soon as a probe succeeds', async () => {
    await create(503);
    expect(service.state()).toBe('waking');

    respondWith(200);
    await service.checkNow({ force: true });

    expect(service.state()).toBe('online');
  });

  it('counts a thrown fetch (timeout, DNS, reset) as a failure', async () => {
    await create(200);

    fetchSpy.and.rejectWith(new TypeError('Failed to fetch'));
    await service.checkNow({ force: true });

    expect(service.state()).toBe('waking');
  });

  it('reports offline without a request when the device has no network', async () => {
    await create(200);

    connectivity.up = false;
    await service.checkNow({ force: true });

    expect(service.state()).toBe('offline');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shares one request between concurrent callers', async () => {
    await create(200);

    await Promise.all([
      service.checkNow({ force: true }),
      service.checkNow({ force: true }),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rate-limits traffic-triggered probes so a burst cannot stampede', async () => {
    await create(200);

    await service.checkNow();
    await service.checkNow();

    expect(fetchSpy).not.toHaveBeenCalled();

    advance(6_000);
    await service.checkNow();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('lets real traffic move the state through reportSuccess / reportFailure', async () => {
    await create(200);

    // A 503 on a real request is immediate evidence, no probe needed.
    service.reportFailure();
    expect(service.state()).toBe('waking');

    service.reportSuccess();
    expect(service.state()).toBe('online');
  });

  it('does not reschedule from traffic when the state did not change', async () => {
    await create(503);

    // Already degraded; repeated failures must not push the poll timer out.
    service.reportFailure();
    service.reportFailure();

    expect(service.state()).toBe('waking');
  });
});
