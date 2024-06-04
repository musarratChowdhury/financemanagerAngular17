import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { StorageService } from '../services/storage.service';

export function authInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) {
  // Inject the current `AuthService` and use it to get an authentication token:
  const authToken = inject(StorageService).getUser();
  // Clone the request to add the authentication header.
  console.log('authToken found');
  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${authToken}`,
      },
    })
  );
}
