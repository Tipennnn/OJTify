import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppwriteService } from '../services/appwrite.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-intern-topnav',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './intern-topnav.component.html',
  styleUrls: ['./intern-topnav.component.css']
})
export class InternTopnavComponent implements OnInit {

  menuOpen          = false;
  showPasswordModal = false;

  showCurrent = false;
  showNew     = false;
  showConfirm = false;

  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  passwordLoading = false;

  profilePhotoUrl = 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff&size=128';

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(
    private router: Router,
    private appwrite: AppwriteService
  ) {}

  async ngOnInit() {
    // Subscribe to photo updates from profile page
    this.appwrite.photoUrl$.subscribe(url => {
      this.profilePhotoUrl = url;
    });

    // Load photo from database on init
    await this.loadProfilePhoto();
  }

  async loadProfilePhoto() {
    try {
      const user = await this.appwrite.account.get();
      const res  = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );

      const docs = res.documents as any[];
      const doc  = docs.find(d => d.$id === user.$id);

      if (doc?.profile_photo_id) {
        const url = `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${doc.profile_photo_id}/view?project=${this.PROJECT_ID}`;
        this.appwrite.updateProfilePhoto(url);
      }
    } catch {
      // Not logged in or no photo
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  goProfile() {
    this.router.navigate(['/intern-profile']);
    this.menuOpen = false;
  }

  openChangePassword() {
    this.showPasswordModal = true;
    this.menuOpen          = false;
    this.currentPassword   = '';
    this.newPassword       = '';
    this.confirmPassword   = '';
  }

  closeModal() {
    this.showPasswordModal = false;
  }

  async updatePassword() {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing fields',
        text: 'Please fill in all password fields.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Passwords do not match',
        text: 'New password and confirm password must be the same.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    if (this.newPassword.length < 8) {
      Swal.fire({
        icon: 'warning',
        title: 'Password too short',
        text: 'Password must be at least 8 characters.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    this.passwordLoading = true;

    try {
      await this.appwrite.account.updatePassword(
        this.newPassword,
        this.currentPassword
      );

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

      this.closeModal();

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: error.message
      });
    } finally {
      this.passwordLoading = false;
    }
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning, Intern!';
    else if (hour < 18) return 'Good Afternoon, Intern!';
    else return 'Good Evening, Intern!';
  }
}