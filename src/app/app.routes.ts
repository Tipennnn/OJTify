import { Routes } from '@angular/router';
import { LandingPageComponent } from './modules/landing-page/landing-page.component';
import { InternLoginComponent } from './Intern/intern-login/intern-login.component';
import { InternRegisterComponent } from './Intern/intern-register/intern-register.component';
import { InternSidenavComponent } from './intern-sidenav/intern-sidenav.component';
import { InternProfileComponent } from './intern-profile/intern-profile.component';
import { InternDashboardComponent } from './intern-dashboard/intern-dashboard.component';
import { InternAttendanceComponent } from './intern-attendance/intern-attendance.component';
import { InternTasksComponent } from './intern-tasks/intern-tasks.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { AdminLoginComponent } from './admin/admin-login/admin-login.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { AdminSidenavComponent } from './admin/admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from './admin/admin-topnav/admin-topnav.component';
import { AdminApplicantsComponent } from './admin/admin-applicants/admin-applicants.component';
import { AdminTasksComponent } from './admin/admin-tasks/admin-tasks.component';
import { AdminOjtComponent } from './admin/admin-ojt/admin-ojt.component';
import { AdminAttendanceComponent } from './admin/admin-attendance/admin-attendance.component';
import { AdminOjtProfileComponent } from './admin/admin-ojt-profile/admin-ojt-profile.component';
import { AdminAttendanceHistoryComponent } from './admin/admin-attendance-history/admin-attendance-history.component';
import { AdminCompletedOjtComponent } from './admin/admin-completed-ojt/admin-completed-ojt.component';
import { AdminCertificateComponent } from './admin/admin-certificate/admin-certificate.component';
import { AdminSupervisorManagementComponent } from './admin/admin-supervisor-management/admin-supervisor-management.component';
import { SupervisorLoginComponent } from './supervisor/supervisor-login/supervisor-login.component';
import { SupervisorSidenavComponent } from './supervisor/supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from './supervisor/supervisor-topnav/supervisor-topnav.component';
import { SupervisorOjtComponent } from './supervisor/supervisor-ojt/supervisor-ojt.component';
import { SupervisorOjtProfileComponent } from './supervisor/supervisor-ojt-profile/supervisor-ojt-profile.component';
import { SupervisorAttendanceComponent } from './supervisor/supervisor-attendance/supervisor-attendance.component';
import { SupervisorAttendanceHistoryComponent } from './supervisor/supervisor-attendance-history/supervisor-attendance-history.component';
import { SupervisorTasksComponent } from './supervisor/supervisor-tasks/supervisor-tasks.component';
import { SupervisorDashboardComponent } from './supervisor/supervisor-dashboard/supervisor-dashboard.component';
import { SupervisorEvaluationComponent } from './supervisor/supervisor-evaluation/supervisor-evaluation.component';
import { InternEvaluationComponent } from './Intern/intern-evaluation/intern-evaluation.component';
import { CertVerifyComponent } from './modules/cert-verify/cert-verify.component';
import { DtrVerifyComponent } from './modules/dtr-verify/dtr-verify.component';
import { LogbookVerifyComponent } from './modules/logbook-verify/logbook-verify.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [

  // ── Landing Page (Public, default route) ──────────────
  { path: '', component: LandingPageComponent },            // ← THIS IS THE FIX

  // ── Public routes (no guard) ───────────────────────────
  { path: 'intern-login',           component: InternLoginComponent },
  { path: 'intern-register',        component: InternRegisterComponent },
  { path: 'admin-login',            component: AdminLoginComponent },
  { path: 'supervisor-login',       component: SupervisorLoginComponent },
  { path: 'reset-password',         component: ResetPasswordComponent },

  // ── Verify routes — specific paths BEFORE the wildcard :id ──
  { path: 'verify/dtr/:ref',        component: DtrVerifyComponent },
  { path: 'verify/logbook/:ref',    component: LogbookVerifyComponent },
  { path: 'verify/:id',             component: CertVerifyComponent },

  // ── Intern protected routes ────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    data: { role: 'intern' },
    children: [
      { path: 'intern-dashboard',  component: InternDashboardComponent },
      { path: 'intern-profile',    component: InternProfileComponent },
      { path: 'intern-attendance', component: InternAttendanceComponent },
      { path: 'intern-tasks',      component: InternTasksComponent },
      { path: 'intern-evaluation', component: InternEvaluationComponent },
      { path: 'intern-sidenav',    component: InternSidenavComponent },
    ]
  },

  // ── Admin protected routes ─────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    data: { role: 'admin' },
    children: [
      { path: 'admin-dashboard',             component: AdminDashboardComponent },
      { path: 'admin-applicants',            component: AdminApplicantsComponent },
      { path: 'admin-tasks',                 component: AdminTasksComponent },
      { path: 'admin-ojt',                   component: AdminOjtComponent },
      { path: 'admin-attendance',            component: AdminAttendanceComponent },
      { path: 'admin-ojt-profile/:id',       component: AdminOjtProfileComponent },
      { path: 'admin-attendance-history',    component: AdminAttendanceHistoryComponent },
      { path: 'admin-completed-ojt',         component: AdminCompletedOjtComponent },
      { path: 'admin-certificate',           component: AdminCertificateComponent },
      { path: 'admin-supervisor-management', component: AdminSupervisorManagementComponent },
      { path: 'admin-sidenav',               component: AdminSidenavComponent },
      { path: 'admin-topnav',                component: AdminTopnavComponent },
    ]
  },

  // ── Supervisor protected routes ────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    data: { role: 'supervisor' },
    children: [
      { path: 'supervisor-dashboard',          component: SupervisorDashboardComponent },
      { path: 'supervisor-ojt',                component: SupervisorOjtComponent },
      { path: 'supervisor-ojt-profile/:id',    component: SupervisorOjtProfileComponent },
      { path: 'supervisor-attendance',         component: SupervisorAttendanceComponent },
      { path: 'supervisor-attendance-history', component: SupervisorAttendanceHistoryComponent },
      { path: 'supervisor-tasks',              component: SupervisorTasksComponent },
      { path: 'supervisor-evaluation',         component: SupervisorEvaluationComponent },
      { path: 'supervisor-sidenav',            component: SupervisorSidenavComponent },
      { path: 'supervisor-topnav',             component: SupervisorTopnavComponent },
    ]
  },

];