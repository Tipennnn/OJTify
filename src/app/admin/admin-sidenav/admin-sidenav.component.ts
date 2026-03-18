import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-admin-sidenav',
  standalone: true, // ✅ ADD THIS
  imports: [CommonModule, RouterModule], // ✅ ADD THIS
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
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    this.router.navigate(['/login']);
  }
}