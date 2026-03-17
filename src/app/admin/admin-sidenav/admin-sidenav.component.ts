import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-sidenav',
  templateUrl: './admin-sidenav.component.html',
  styleUrls: ['./admin-sidenav.component.css']
})
export class AdminSidenavComponent {

  isCollapsed = false;

  constructor(private router: Router) {}

  toggleNav() {
    this.isCollapsed = !this.isCollapsed;
  }

  onLogout() {
    // Clear authentication (adjust based on your auth system)
    localStorage.removeItem('token');
    localStorage.removeItem('role');

    // Redirect to login
    this.router.navigate(['/login']);
  }

}