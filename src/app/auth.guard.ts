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
  return inject(StorageService).isLoggedIn(); // your  logic goes here
};
