import { Routes } from '@angular/router';
import { InternLoginComponent } from './Intern/intern-login/intern-login.component';
import { InternRegisterComponent } from './Intern/intern-register/intern-register.component';
import { InternSidenavComponent } from './intern-sidenav/intern-sidenav.component';
import { InternProfileComponent } from './intern-profile/intern-profile.component';
import { InternDashboardComponent } from './intern-dashboard/intern-dashboard.component';
import { InternAttendanceComponent } from './intern-attendance/intern-attendance.component';
import { InternTasksComponent } from './intern-tasks/intern-tasks.component';

export const routes: Routes = [
  { path: '', redirectTo: 'intern-login', pathMatch: 'full' },
  { path: 'intern-login', component: InternLoginComponent },
  { path: 'intern-register', component: InternRegisterComponent },
  { path: 'intern-sidenav', component: InternSidenavComponent }, 
  { path: 'intern-profile', component: InternProfileComponent },
  { path: 'intern-dashboard', component: InternDashboardComponent },
  { path: 'intern-attendance', component: InternAttendanceComponent },
  { path: 'intern-tasks', component: InternTasksComponent },
];