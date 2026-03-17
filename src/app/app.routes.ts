import { Routes } from '@angular/router';
import { InternLoginComponent } from './Intern/intern-login/intern-login.component';
import { InternRegisterComponent } from './Intern/intern-register/intern-register.component';
import { InternSidenavComponent } from './intern-sidenav/intern-sidenav.component';
import { InternProfileComponent } from './intern-profile/intern-profile.component';
import { InternDashboardComponent } from './intern-dashboard/intern-dashboard.component';
import { InternAttendanceComponent } from './intern-attendance/intern-attendance.component';
import { InternTasksComponent } from './intern-tasks/intern-tasks.component';
import { AdminLoginComponent } from './admin/admin-login/admin-login.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { AdminSidenavComponent } from './admin/admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from './admin/admin-topnav/admin-topnav.component';
import { authGuard } from './guards/auth.guard';


export const routes: Routes = [
  { path: '', redirectTo: 'intern-login', pathMatch: 'full' },
  { path: 'intern-login', component: InternLoginComponent },
  { path: 'intern-register', component: InternRegisterComponent },
  { path: 'intern-sidenav', component: InternSidenavComponent }, 
  { path: 'intern-profile', component: InternProfileComponent },
  { path: 'intern-dashboard', component: InternDashboardComponent },
  { path: 'intern-attendance', component: InternAttendanceComponent },
  { path: 'intern-tasks', component: InternTasksComponent },
  { path: 'intern-dashboard',component: InternDashboardComponent,canActivate: [authGuard] },
    // ADMIN
    { path: 'admin-login', component: AdminLoginComponent },
    { path: 'admin-dashboard', component: AdminDashboardComponent },
    { path: 'admin-sidenav', component: AdminSidenavComponent },
    { path: 'admin-topnav', component: AdminTopnavComponent },
];