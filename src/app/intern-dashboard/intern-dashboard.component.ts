import { Component } from '@angular/core';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';

@Component({
selector: 'app-intern-dashboard',
standalone: true,
imports: [InternSidenavComponent, InternTopnavComponent],
templateUrl: './intern-dashboard.component.html',
styleUrls: ['./intern-dashboard.component.css']
})
export class InternDashboardComponent {
  
}