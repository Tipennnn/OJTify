import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppwriteService } from '../services/appwrite.service';

export const authGuard: CanActivateFn = async () => {
  const appwrite = inject(AppwriteService);
  const router   = inject(Router);

  try {
    await appwrite.account.getSession('current');
    return true;
  } catch {
    router.navigate(['/intern-login']);
    return false;
  }
};