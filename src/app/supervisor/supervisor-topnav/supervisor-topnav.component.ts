import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-supervisor-topnav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './supervisor-topnav.component.html',
  styleUrls: ['./supervisor-topnav.component.css']
})
export class SupervisorTopnavComponent {

  menuOpen = false;
  showPasswordModal = false;

  showCurrent = false;
  showNew = false;
  showConfirm = false;

  constructor(private router: Router) {}

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  goProfile(): void {
    this.router.navigate(['/supervisor-profile']);
    this.menuOpen = false;
  }

  openChangePassword(): void {
    this.showPasswordModal = true;
    this.menuOpen = false;
  }

  closeModal(): void {
    this.showPasswordModal = false;
  }

  updatePassword(): void {
    console.log('Supervisor Password Updated');
    this.showPasswordModal = false;
  }

  get greeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) return 'Good Morning, Supervisor!';
    else if (hour < 18) return 'Good Afternoon, Supervisor!';
    else return 'Good Evening, Supervisor!';
  }

}