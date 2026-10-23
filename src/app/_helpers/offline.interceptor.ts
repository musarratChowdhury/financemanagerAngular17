import { HttpHandlerFn, HttpRequest, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, throwError, Observable, of, switchMap } from 'rxjs';
import { ConnectivityService } from '../services/connectivity.service';
import { OfflineStoreService } from '../services/offline-store.service';
import { StorageService } from '../services/storage.service';

/** Error thrown when a mutation is queued for later sync. */
export class OfflineQueuedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfflineQueuedError';
  }
}

/** Error thrown when offline with no cached data. */
export class OfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfflineError';
  }
}

/** Type guard for OfflineQueuedError. */
export function isOfflineQueuedError(error: unknown): error is OfflineQueuedError {
  return error instanceof OfflineQueuedError;
}

/** Type guard for OfflineError. */
export function isOfflineError(error: unknown): error is OfflineError {
  return error instanceof OfflineError;
}

/**
 * Offline interceptor — registered LAST so it sees the request AFTER the auth token is attached.
 *
 * Behavior:
 * - GET requests: try network first; on network failure, serve from IndexedDB cache.
 * - Mutation requests (POST/PUT/PATCH/DELETE): try network; on network failure, enqueue in IndexedDB.
 * - Only network failures (TypeError, status 0) are queued/cached. 4xx/5xx are NOT queued.
 *
 * Interceptor order in app.config.ts:
 *   withInterceptors([authInterceptor, offlineInterceptor])
 */
export function offlineInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  const connectivity = inject(ConnectivityService);
  const offlineStore = inject(OfflineStoreService);
  const storage = inject(StorageService);

  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const isGet = req.method === 'GET';
  const isReceiptScan = req.url.includes('/Receipt/Scan');

  // Multipart receipt images cannot be safely serialized and replayed by the
  // offline store, so let the request fail normally when it cannot reach API.
  if (isReceiptScan) {
    return next(req);
  }

  // Initialize IndexedDB (idempotent) - returns a promise, convert to observable
  const init$ = from(offlineStore.init().catch((err) => {
    console.warn('[OfflineInterceptor] IndexedDB init failed:', err);
  }));

  return init$.pipe(
    switchMap(() => {
      // If we're online, try the network first
      if (connectivity.isOnline()) {
        return next(req).pipe(
          catchError((error: HttpErrorResponse) => {
            // Network error (offline, CORS, DNS, etc.) — status 0 or TypeError
            const isNetworkError =
              error.status === 0 || error instanceof TypeError;

            if (isNetworkError) {
              if (isMutation) {
                // Enqueue mutation for later replay
                return from(enqueueMutation(req, offlineStore)).pipe(
                  switchMap(() => throwError(() => new OfflineQueuedError('Request queued for sync')))
                );
              } else if (isGet) {
                // Try to serve from cache
                return from(offlineStore.getCachedResponse(req.urlWithParams)).pipe(
                  switchMap((cached) => {
                    if (cached !== null) {
                      console.log('[OfflineInterceptor] Served from cache:', req.url);
                      // Return cached response as a synthetic HttpResponse
                      return of(createHttpResponse(req, cached));
                    }
                    return throwError(() => error);
                  })
                );
              }
            }

            // Re-throw for non-network errors or if caching/queueing failed
            return throwError(() => error);
          })
        );
      }

      // We're offline
      if (isMutation) {
        // Queue the mutation
        return from(enqueueMutation(req, offlineStore)).pipe(
          switchMap(() => throwError(() => new OfflineQueuedError('Request queued for sync')))
        );
      }

      if (isGet) {
        // Try cache
        return from(offlineStore.getCachedResponse(req.urlWithParams)).pipe(
          switchMap((cached) => {
            if (cached !== null) {
              console.log('[OfflineInterceptor] Served from cache (offline):', req.url);
              return of(createHttpResponse(req, cached));
            }
            return throwError(() => new OfflineError('Offline and no cached response'));
          })
        );
      }

      // No cache, offline — throw offline error
      return throwError(() => new OfflineError('Offline and no cached response'));
    })
  );
}

/** Helper to enqueue a mutation request. */
async function enqueueMutation(
  req: HttpRequest<unknown>,
  offlineStore: OfflineStoreService
): Promise<void> {
  const headers: Record<string, string> = {};
  req.headers.keys().forEach((key) => {
    headers[key] = req.headers.get(key) ?? '';
  });

  await offlineStore.enqueueWrite(req.method, req.urlWithParams, req.body, headers);
  console.log('[OfflineInterceptor] Queued offline write:', req.method, req.url);
}

/** Create a minimal HttpResponse-like object from cached data. */
function createHttpResponse(req: HttpRequest<unknown>, body: any): HttpEvent<unknown> {
  // We return the cached body directly; the interceptor chain expects HttpEvent
  // but since we're short-circuiting, returning the body works for the subscriber
  return body as HttpEvent<unknown>;
}