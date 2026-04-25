import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AppwriteService } from '../services/appwrite.service';
import { Query } from 'appwrite';

export const authGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const appwrite = inject(AppwriteService);
  const router   = inject(Router);

  const requiredRole = route.data['role'];

  const loginRoutes: Record<string, string> = {
    admin      : '/admin-login',
    intern     : '/intern-login',
    supervisor : '/supervisor-login'
  };

  const redirectTo = loginRoutes[requiredRole] ?? '/intern-login';

  try {
    const user = await appwrite.account.get();

    // Get role from sessionStorage first (fast path)
    let currentRole = sessionStorage.getItem('role');

    // If sessionStorage is empty (new tab), detect role from DB
    if (!currentRole) {
      currentRole = await detectRole(appwrite, user.$id);
      if (currentRole) {
        sessionStorage.setItem('role', currentRole);
      }
    }

    if (currentRole !== requiredRole) {
      // Redirect them to their correct dashboard instead of login
      const dashboards: Record<string, string> = {
        admin      : '/admin-dashboard',
        intern     : '/intern-dashboard',
        supervisor : '/supervisor-dashboard'
      };
      const correctDash = dashboards[currentRole ?? ''];
      if (correctDash) {
        router.navigate([correctDash]);
      } else {
        router.navigate([redirectTo]);
      }
      return false;
    }

    return true;

  } catch {
    router.navigate([redirectTo]);
    return false;
  }
};

async function detectRole(appwrite: AppwriteService, userId: string): Promise<string | null> {
  try {
    // Check admin
    const adminRes = await appwrite.databases.listDocuments(
      appwrite.DATABASE_ID,
      appwrite.ADMINS_COL,
      [Query.limit(100)]
    );
    const isAdmin = (adminRes.documents as any[])
      .some(a => a.auth_user_id === userId);
    if (isAdmin) return 'admin';

    // Check supervisor
    const supRes = await appwrite.databases.listDocuments(
      appwrite.DATABASE_ID,
      appwrite.SUPERVISORS_COL,
      [Query.limit(100)]
    );
    const isSupervisor = (supRes.documents as any[])
      .some(s => s.$id === userId);
    if (isSupervisor) return 'supervisor';

    // Check intern
    const internRes = await appwrite.databases.listDocuments(
      appwrite.DATABASE_ID,
      appwrite.STUDENTS_COL,
      [Query.limit(100)]
    );
    const isIntern = (internRes.documents as any[])
      .some(s => s.$id === userId);
    if (isIntern) return 'intern';

    return null;
  } catch {
    return null;
  }
}