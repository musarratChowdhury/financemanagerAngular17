import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ApiHealthService } from '../services/api-health.service';
import { isOfflineError, isOfflineQueuedError } from './offline.interceptor';

/**
 * Feeds real API traffic into `ApiHealthService`, so the status indicator
 * reacts the moment something fails instead of waiting for the next poll.
 *
 * Purely an observer: it never edits the request or the response, so it cannot
 * change how any screen behaves. Registered FIRST in `app.config.ts` because
 * `offlineInterceptor` converts network failures into `OfflineQueuedError` /
 * `OfflineError` - an interceptor further in would never see the original
 * `HttpErrorResponse` (§ app.config.ts).
 */
export function apiStatusInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) {
  // Only our own API speaks for the API's health; a third-party call that fails
  // (an image CDN, a font) says nothing about Render.
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const health = inject(ApiHealthService);

  return next(req).pipe(
    tap({
      next: () => health.reportSuccess(),
      error: (error: unknown) => {
        if (isUnreachable(error)) health.reportFailure();
      },
    })
  );
}

/**
 * Did this error mean the API itself could not be reached?
 *
 * A 4xx is NOT a failure here: a 401 or a 400 still proves the server answered,
 * and treating it as an outage would make the indicator cry wolf whenever a
 * token expired or a form was rejected.
 */
function isUnreachable(error: unknown): boolean {
  // The offline layer swallowed a network failure and queued/cached instead.
  if (isOfflineQueuedError(error) || isOfflineError(error)) return true;

  if (error instanceof HttpErrorResponse) {
    return (
      error.status === 0 ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504
    );
  }

  return false;
}
