import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-supervisor-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './supervisor-login.component.html',
  styleUrl: './supervisor-login.component.css'
})
export class SupervisorLoginComponent implements OnInit {

  email        = '';
  password     = '';
  rememberMe   = false;
  showPassword = false;
  loading      = false;
  errorMessage = '';

  // ── Forgot password ───────────────────────────────────────
  forgotStep        = 0;
  fpEmail           = '';
  fpOtp             = '';
  fpEnteredOtp      = '';
  fpNewPassword     = '';
  fpConfirmPassword = '';
  fpShowNew         = false;
  fpShowConfirm     = false;
  fpLoading         = false;
  fpError           = '';
  fpOtpExpiry       = 0;
  fpUserName        = '';
  fpUserId          = '';

  constructor(
    private appwrite: AppwriteService,
    private router  : Router
  ) {}

  ngOnInit() {
    if (sessionStorage.getItem('supervisorLoggedOut')) {
      sessionStorage.removeItem('supervisorLoggedOut');
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

  togglePassword() { this.showPassword = !this.showPassword; }

  // ── LOGIN ─────────────────────────────────────────────────
  async onLogin() {
    this.errorMessage = '';
    this.loading      = true;

    try {
      // Clear any existing session
      try { await this.appwrite.account.deleteSession('current'); } catch { }

      await this.appwrite.account.createEmailPasswordSession(
        this.email, this.password
      );

      const user = await this.appwrite.account.get();

      // Check if supervisor exists in supervisors collection
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL
      );

      const supervisor = (res.documents as any[])
        .find(s => s.$id === user.$id);

      if (!supervisor) {
        await this.appwrite.account.deleteSession('current');
        this.errorMessage = 'No supervisor account found. Please contact the admin.';
        return;
      }

      if ((supervisor.status || 'Active') === 'Inactive') {
        await this.appwrite.account.deleteSession('current');
        this.errorMessage = 'Your account has been deactivated. Please contact the admin.';
        return;
      }

      sessionStorage.removeItem('supervisorWelcomeShown');
      this.router.navigate(['/supervisor-dashboard']);

    } catch (error: any) {
      this.errorMessage = error.message ?? 'Invalid email or password. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  // ── FORGOT PASSWORD ───────────────────────────────────────
  openForgotPassword() {
    this.forgotStep        = 1;
    this.fpEmail           = '';
    this.fpOtp             = '';
    this.fpEnteredOtp      = '';
    this.fpNewPassword     = '';
    this.fpConfirmPassword = '';
    this.fpError           = '';
    this.fpLoading         = false;
  }

  closeForgotPassword() {
    this.forgotStep = 0;
    this.fpError    = '';
  }

  async sendOtp() {
    if (!this.fpEmail) {
      this.fpError = 'Please enter your email address.';
      return;
    }
    this.fpLoading = true;
    this.fpError   = '';

    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL
      );

      const supervisor = (res.documents as any[])
        .find(s => s.email === this.fpEmail);

      if (!supervisor) {
        this.fpError   = 'No supervisor account found with this email.';
        this.fpLoading = false;
        return;
      }

      this.fpUserName  = `${supervisor.first_name} ${supervisor.last_name}`;
      this.fpUserId    = supervisor.$id;
      this.fpOtp       = Math.floor(100000 + Math.random() * 900000).toString();
      this.fpOtpExpiry = Date.now() + (10 * 60 * 1000);

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': environment.brevoApiKey
        },
        body: JSON.stringify({
          sender: { name: 'OJTify Admin', email: 'adminojtify@gmail.com' },
          to: [{ email: this.fpEmail, name: this.fpUserName }],
          templateId: environment.brevoOtpTid,
          params: { user_name: this.fpUserName, otp_code: this.fpOtp }
        })
      });

      if (!response.ok) {
        this.fpError = 'Failed to send OTP. Please try again.';
        return;
      }

      this.forgotStep = 2;

    } catch (error: any) {
      this.fpError = 'Failed to send OTP. Please try again.';
    } finally {
      this.fpLoading = false;
    }
  }

  verifyOtp() {
    this.fpError = '';
    if (!this.fpEnteredOtp) { this.fpError = 'Please enter the OTP code.'; return; }
    if (Date.now() > this.fpOtpExpiry) {
      this.fpError = 'OTP has expired. Please request a new one.';
      this.forgotStep = 1; return;
    }
    if (this.fpEnteredOtp.trim() !== this.fpOtp) {
      this.fpError = 'Invalid OTP code. Please try again.'; return;
    }
    this.forgotStep = 3;
  }

  resendOtp() {
    this.fpEnteredOtp = '';
    this.fpError      = '';
    this.forgotStep   = 1;
  }

  async resetPassword() {
    this.fpError = '';
    if (!this.fpNewPassword || !this.fpConfirmPassword) {
      this.fpError = 'Please fill in all fields.'; return;
    }
    if (this.fpNewPassword.length < 8) {
      this.fpError = 'Password must be at least 8 characters.'; return;
    }
    if (this.fpNewPassword !== this.fpConfirmPassword) {
      this.fpError = 'Passwords do not match.'; return;
    }
    this.fpLoading = true;
    try {
      const response = await fetch(
        `https://sgp.cloud.appwrite.io/v1/users/${this.fpUserId}/password`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':       'application/json',
            'X-Appwrite-Project': '69ba8d9c0027d10c447f',
            'X-Appwrite-Key':     environment.appwriteApiKey
          },
          body: JSON.stringify({ password: this.fpNewPassword })
        }
      );

      if (!response.ok) {
        const err = await response.json();
        this.fpError = err.message || 'Failed to reset password.';
        return;
      }

      this.closeForgotPassword();
      Swal.fire({
        icon: 'success', title: 'Password Reset!',
        text: 'Your password has been changed. You can now log in.',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 4000, timerProgressBar: true
      });
    } catch (error: any) {
      this.fpError = 'Failed to reset password. Please try again.';
    } finally {
      this.fpLoading = false;
    }
  }
}