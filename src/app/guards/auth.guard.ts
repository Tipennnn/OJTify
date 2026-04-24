import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AppwriteService } from '../services/appwrite.service';

export const authGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const appwrite = inject(AppwriteService);
  const router   = inject(Router);

  // Get the role from route data
  const role = route.data['role'];

  // Redirect map
  const loginRoutes: Record<string, string> = {
    admin      : '/admin-login',
    intern     : '/intern-login',
    supervisor : '/supervisor-login'
  };

  const redirectTo = loginRoutes[role] ?? '/intern-login';

  try {
    await appwrite.account.getSession('current');
    return true;
  } catch {
    router.navigate([redirectTo]);
    return false;
  }
};