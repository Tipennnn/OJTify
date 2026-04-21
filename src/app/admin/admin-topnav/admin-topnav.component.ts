import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-topnav',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-topnav.component.html',
  styleUrls: ['./admin-topnav.component.css']
})
export class AdminTopnavComponent implements OnInit, OnDestroy {

  menuOpen          = false;
  showPasswordModal = false;

  showCurrent = false;
  showNew     = false;
  showConfirm = false;

  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  passwordLoading = false;

  pwError       = '';
  pwSuccess     = '';
  pwFieldErrors = { current: '', newPw: '', confirm: '' };

  // DateTime
  currentDayDate = '';
  currentTime    = '';
  private clockInterval: any;

  constructor(
    private router: Router,
    private appwrite: AppwriteService
  ) {}

  ngOnInit() {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  private updateClock(): void {
    const now = new Date();

    const shortDays   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const day   = shortDays[now.getDay()];
    const month = shortMonths[now.getMonth()];
    const date  = now.getDate();
    const year  = now.getFullYear();

    this.currentDayDate = `${day}, ${month} ${date}, ${year}`;

    let hours  = now.getHours();
    const mins = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours      = hours % 12 || 12;
    this.currentTime = `${hours}:${mins} ${ampm}`;
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  goProfile() {
    this.router.navigate(['/admin-profile']);
    this.menuOpen = false;
  }

  openChangePassword() {
    this.showPasswordModal = true;
    this.menuOpen          = false;
    this.currentPassword   = '';
    this.newPassword       = '';
    this.confirmPassword   = '';
    this.pwError           = '';
    this.pwSuccess         = '';
    this.pwFieldErrors     = { current: '', newPw: '', confirm: '' };
  }

  closeModal() {
    this.showPasswordModal = false;
    this.currentPassword   = '';
    this.newPassword       = '';
    this.confirmPassword   = '';
    this.pwError           = '';
    this.pwSuccess         = '';
    this.pwFieldErrors     = { current: '', newPw: '', confirm: '' };
  }

  validateStrongPassword(password: string): string {
    if (password.length < 8)
      return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password))
      return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password))
      return 'Password must contain at least one number.';
    if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]=+;/']/.test(password))
      return 'Password must contain at least one special character.';
    return '';
  }

  async updatePassword() {
    this.pwError       = '';
    this.pwSuccess     = '';
    this.pwFieldErrors = { current: '', newPw: '', confirm: '' };

    let hasError = false;

    if (!this.currentPassword) {
      this.pwFieldErrors.current = 'Current password is required.';
      hasError = true;
    }

    if (!this.newPassword) {
      this.pwFieldErrors.newPw = 'New password is required.';
      hasError = true;
    } else {
      const strengthError = this.validateStrongPassword(this.newPassword);
      if (strengthError) {
        this.pwFieldErrors.newPw = strengthError;
        hasError = true;
      } else if (this.newPassword === this.currentPassword) {
        this.pwFieldErrors.newPw = 'New password must be different from current.';
        hasError = true;
      }
    }

    if (!this.confirmPassword) {
      this.pwFieldErrors.confirm = 'Please confirm your new password.';
      hasError = true;
    } else if (this.newPassword && this.confirmPassword !== this.newPassword) {
      this.pwFieldErrors.confirm = 'Passwords do not match.';
      hasError = true;
    }

    if (hasError) return;

    this.passwordLoading = true;
    try {
      await this.appwrite.account.updatePassword(this.newPassword, this.currentPassword);

      this.pwSuccess       = 'Password updated successfully!';
      this.currentPassword = '';
      this.newPassword     = '';
      this.confirmPassword = '';

      setTimeout(() => {
        this.closeModal();
        Swal.fire({
          icon: 'success',
          title: 'Password Updated!',
          text: 'Your password has been changed successfully.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      }, 1200);

    } catch (error: any) {
      const msg: string = error.message ?? '';
      if (msg.toLowerCase().includes('invalid credentials') ||
          msg.toLowerCase().includes('current') ||
          error.code === 401) {
        this.pwFieldErrors.current = 'Current password is incorrect.';
      } else {
        this.pwError = 'Failed to update password. Please try again.';
      }
    } finally {
      this.passwordLoading = false;
    }
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning, Admin!';
    else if (hour < 18) return 'Good Afternoon, Admin!';
    else return 'Good Evening, Admin!';
  }
}