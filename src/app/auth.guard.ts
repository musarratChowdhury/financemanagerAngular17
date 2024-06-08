import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from './services/auth.service';
import { Injectable, inject } from '@angular/core';
import { StorageService } from './services/storage.service';

export const authGuard: CanActivateFn = (
  next: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  if (inject(StorageService).isLoggedIn()) {
    return true;
  } else {
    inject(Router).navigate(['/login']);
    return false;
  }
};
