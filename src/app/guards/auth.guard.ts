import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AppwriteService } from '../services/appwrite.service';

export const authGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const appwrite = inject(AppwriteService);
  const router   = inject(Router);

  const requiredRole = route.data['role'];  // role from routes.ts
  const currentRole  = sessionStorage.getItem('role');  // role from login

  const loginRoutes: Record<string, string> = {
    admin      : '/admin-login',
    intern     : '/intern-login',
    supervisor : '/supervisor-login'
  };

  const redirectTo = loginRoutes[requiredRole] ?? '/intern-login';

  try {
    await appwrite.account.getSession('current');

    // ✅ Has session, now check if role matches
    if (currentRole !== requiredRole) {
      router.navigate([redirectTo]);  // wrong role, kick them out
      return false;
    }

    return true;
  } catch {
    router.navigate([redirectTo]);  // no session
    return false;
  }
};