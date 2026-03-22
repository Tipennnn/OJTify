import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router'; // <-- import RouterModule & Router

@Component({
  selector: 'app-admin-attendance-history',
  standalone: true,
  imports: [RouterModule], // <-- add RouterModule so routerLink works
  templateUrl: './admin-attendance-history.component.html',
  styleUrls: ['./admin-attendance-history.component.css'] // <-- fixed typo: styleUrls (was styleUrl)
})
export class AdminAttendanceHistoryComponent {

  constructor(private router: Router) {} // inject router

  goBack() {
    this.router.navigate(['/admin-attendance']); // navigate to your attendance component
  }
}