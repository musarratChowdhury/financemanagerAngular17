import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { Injectable } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  return true;
};
