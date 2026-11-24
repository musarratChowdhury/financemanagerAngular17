import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './_helpers/auth.interceptor';
import { offlineInterceptor } from './_helpers/offline.interceptor';
import { apiStatusInterceptor } from './_helpers/api-status.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
// import { AuthInterceptor } from './_helpers/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      // Order matters: `apiStatusInterceptor` is outermost so it still sees the
      // original network error. `offlineInterceptor` rewrites a failed request
      // into an OfflineQueuedError / cached response, so anything registered
      // inside it would only ever observe the rewrite.
      withInterceptors([apiStatusInterceptor, authInterceptor, offlineInterceptor])
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ],
};
