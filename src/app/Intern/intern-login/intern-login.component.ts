import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-intern-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './intern-login.component.html',
  styleUrls: ['./intern-login.component.css']
})
export class InternLoginComponent implements OnInit {

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
    if (sessionStorage.getItem('loggedOut')) {
      sessionStorage.removeItem('loggedOut');
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
    // Delete any existing session first to avoid conflicts
    try {
      await this.appwrite.account.deleteSession('current');
    } catch {
      // No active session, that's fine
    }

    await this.appwrite.account.createEmailPasswordSession(
      this.email,
      this.password
    );
    sessionStorage.removeItem('welcomeShown');
    this.router.navigate(['/intern-dashboard']);
  } catch (error: any) {
    // Show the actual error so we know what's happening
    this.errorMessage = error.message ?? 'Invalid email or password. Please try again.';
  } finally {
    this.loading = false;
  }
}
}