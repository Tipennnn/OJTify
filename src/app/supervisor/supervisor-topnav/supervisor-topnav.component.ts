import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-supervisor-topnav',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supervisor-topnav.component.html',
  styleUrls: ['./supervisor-topnav.component.css']
})
export class SupervisorTopnavComponent implements OnInit, OnDestroy {

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

  profilePhotoUrl = 'https://ui-avatars.com/api/?name=Supervisor&background=0818A8&color=fff&size=128';

  // DateTime
  currentDayDate = '';
  currentTime    = '';
  private clockInterval: any;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(
    private router: Router,
    private appwrite: AppwriteService
  ) {}

  async ngOnInit() {
    await this.loadProfilePhoto();
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

  async loadProfilePhoto() {
    try {
      const user = await this.appwrite.account.get();
      const res  = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL
      );
      const doc = (res.documents as any[]).find(d => d.$id === user.$id);

      if (doc?.profile_photo_id) {
        this.profilePhotoUrl = `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${doc.profile_photo_id}/view?project=${this.PROJECT_ID}`;
      } else {
        this.profilePhotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Supervisor')}&background=0818A8&color=fff&size=128`;
      }
    } catch {
      this.profilePhotoUrl = 'https://ui-avatars.com/api/?name=Supervisor&background=0818A8&color=fff&size=128';
    }
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  goProfile() {
    this.router.navigate(['/supervisor-profile']);
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
    if (hour < 12) return 'Good Morning, Supervisor!';
    else if (hour < 18) return 'Good Afternoon, Supervisor!';
    else return 'Good Evening, Supervisor!';
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
}