import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { Query } from 'appwrite';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent implements OnInit {

  email        = '';
  password     = '';
  rememberMe   = false;
  showPassword = false;
  loading      = false;
  errorMessage = '';

  constructor(
    private appwrite: AppwriteService,
    private router: Router
  ) {}

  ngOnInit() {
    if (sessionStorage.getItem('adminLoggedOut')) {
      sessionStorage.removeItem('adminLoggedOut');
      Swal.fire({
        icon: 'success',
        title: 'Logged out successfully',
        text: 'See you next time!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onLogin() {
    this.errorMessage = '';
    this.loading = true;

    try {
      // 1. Delete existing session if any
      try {
        await this.appwrite.account.deleteSession('current');
      } catch { }

      // 2. Sign in
      await this.appwrite.account.createEmailPasswordSession(
        this.email,
        this.password
      );

      // 3. Check if this user is in the admins table
      const result = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ADMINS_COL,
        [Query.equal('email', this.email)]
      );

      if (result.total === 0) {
        // Not an admin — sign out and block
        await this.appwrite.account.deleteSession('current');
        this.errorMessage = 'Access denied. You are not an admin.';
        return;
      }

      // 4. Confirmed admin
      sessionStorage.removeItem('adminWelcomeShown');
      this.router.navigate(['/admin-dashboard']);

    } catch (error: any) {
      this.errorMessage = error.message ?? 'Invalid email or password. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}