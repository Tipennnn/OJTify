import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-topnav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-topnav.component.html',
  styleUrls: ['./admin-topnav.component.css']
})
export class AdminTopnavComponent {

  menuOpen = false;
  showPasswordModal = false;

  showCurrent = false;
  showNew = false;
  showConfirm = false;

  constructor(private router: Router) {}

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  goProfile() {
    this.router.navigate(['/admin-profile']); // change if needed
    this.menuOpen = false;
  }

  openChangePassword() {
    this.showPasswordModal = true;
    this.menuOpen = false;
  }

  closeModal() {
    this.showPasswordModal = false;
  }

  logout() {
    this.router.navigate(['/admin-login']); // change if needed
  }

  updatePassword() {
    console.log("Admin Password Updated");
    this.showPasswordModal = false;
  }

  get greeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) return "Good Morning, Admin!";
    else if (hour < 18) return "Good Afternoon, Admin!";
    else return "Good Evening, Admin!";
  }

}