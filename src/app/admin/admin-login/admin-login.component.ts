import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { Query } from 'appwrite';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent implements OnInit, OnDestroy {

  email        = '';
  password     = '';
  rememberMe   = false;
  showPassword = false;
  loading      = false;
  errorMessage = '';
  fieldErrors  = { email: '', password: '' };

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
  fpResendCooldown  = 0;
  private fpCooldownTimer: any;

  // ── REPLACE with your new function ID ─────────────────────
  private readonly OTP_FUNCTION_ID = '69edb8fb00176781c74b';

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

  ngOnDestroy() {
    clearInterval(this.fpCooldownTimer);
  }

  togglePassword() { this.showPassword = !this.showPassword; }

  // ── LOGIN ─────────────────────────────────────────────────
  async onLogin() {
    this.errorMessage = '';
    this.fieldErrors  = { email: '', password: '' };

    let hasError = false;

    if (!this.email) {
      this.fieldErrors.email = 'Email is required.';
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.fieldErrors.email = 'Please enter a valid email address.';
      hasError = true;
    }

    if (!this.password) {
      this.fieldErrors.password = 'Password is required.';
      hasError = true;
    } else {
      const passwordError = this.validateStrongPassword(this.password);
      if (passwordError) {
        this.fieldErrors.password = passwordError;
        hasError = true;
      }
    }

    if (hasError) return;

    this.loading = true;

    try {
      try { await this.appwrite.account.deleteSession('current'); } catch { }

      await this.appwrite.account.createEmailPasswordSession(this.email, this.password);

      const result = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ADMINS_COL,
        [Query.equal('email', this.email)]
      );

      if (result.total === 0) {
        await this.appwrite.account.deleteSession('current');
        this.errorMessage = 'Access denied. You are not an admin.';
        return;
      }

      sessionStorage.removeItem('adminWelcomeShown');
      sessionStorage.removeItem('role');
      sessionStorage.setItem('role', 'admin');
      this.router.navigate(['/admin-dashboard']);

    } catch (error: any) {
      const msg: string = error.message ?? '';

      if (msg.toLowerCase().includes('invalid credentials') ||
          msg.toLowerCase().includes('password') ||
          error.code === 401) {
        this.fieldErrors.password = 'Incorrect email or password.';
      } else if (msg.toLowerCase().includes('rate limit') || error.code === 429) {
        this.errorMessage = 'Too many attempts. Please wait a moment and try again.';
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        this.errorMessage = 'Network error. Please check your connection.';
      } else {
        this.errorMessage = 'Something went wrong. Please try again.';
      }
    } finally {
      this.loading = false;
    }
  }

  // ── FORGOT PASSWORD ───────────────────────────────────────
  openForgotPassword() {
    this.forgotStep        = 1;
    this.fpEmail           = this.email;
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

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('fp-overlay')) {
      this.closeForgotPassword();
    }
  }

  // STEP 1 — Send OTP via Appwrite Function
  async sendOtp() {
  if (!this.fpEmail) {
    this.fpError = 'Please enter your email address.';
    return;
  }

  this.fpLoading = true;
  this.fpError   = '';

  try {
    // Use direct fetch with API key since user is not logged in
    const url = `https://sgp.cloud.appwrite.io/v1/databases/${this.appwrite.DATABASE_ID}/collections/${this.appwrite.ADMINS_COL}/documents?queries[]=equal("email","${this.fpEmail}")&limit=1`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type':       'application/json',
        'X-Appwrite-Project': '69ba8d9c0027d10c447f',
        'X-Appwrite-Key':     environment.appwriteApiKey
      }
    });

    if (!res.ok) {
      this.fpError = 'Failed to verify email. Please try again.';
      return;
    }

    const data     = await res.json();
    const adminDoc = (data.documents as any[])[0];

    if (!adminDoc) {
      this.fpError = 'No admin account found with this email.';
      return;
    }

    this.fpUserId   = adminDoc.auth_user_id;
    this.fpUserName = 'Admin';

    this.fpOtp       = Math.floor(100000 + Math.random() * 900000).toString();
    this.fpOtpExpiry = Date.now() + (10 * 60 * 1000);

    // Send via Appwrite Function
    const execution = await this.appwrite.functions.createExecution(
      this.OTP_FUNCTION_ID,
      JSON.stringify({
        action:     'send-otp',
        email:      this.fpEmail,
        userName:   this.fpUserName,
        otp:        this.fpOtp,
        templateId: environment.brevoOtpTid
      }),
      false
    );

    const result = JSON.parse(execution.responseBody);

    if (!result.success) {
      this.fpError = 'Failed to send OTP. Please try again.';
      return;
    }

    this.startResendCooldown();
    this.forgotStep = 2;

  } catch (err) {
    console.error(err);
    this.fpError = 'Failed to send OTP. Please try again.';
  } finally {
    this.fpLoading = false;
  }
}

  // STEP 2 — Verify OTP
  verifyOtp() {
    this.fpError = '';
    if (!this.fpEnteredOtp) { this.fpError = 'Please enter the OTP code.'; return; }
    if (Date.now() > this.fpOtpExpiry) {
      this.fpError    = 'OTP has expired. Please request a new one.';
      this.forgotStep = 1;
      return;
    }
    if (this.fpEnteredOtp.trim() !== this.fpOtp) {
      this.fpError = 'Invalid OTP code. Please try again.';
      return;
    }
    this.forgotStep = 3;
  }

  // Resend OTP
  async resendOtp() {
    if (this.fpResendCooldown > 0) return;

    this.fpEnteredOtp = '';
    this.fpError      = '';
    this.fpLoading    = true;

    try {
      this.fpOtp       = Math.floor(100000 + Math.random() * 900000).toString();
      this.fpOtpExpiry = Date.now() + (10 * 60 * 1000);

      const execution = await this.appwrite.functions.createExecution(
        this.OTP_FUNCTION_ID,
        JSON.stringify({
          action:     'send-otp',
          email:      this.fpEmail,
          userName:   this.fpUserName,
          otp:        this.fpOtp,
          templateId: environment.brevoOtpTid
        }),
        false
      );

      const result = JSON.parse(execution.responseBody);

      if (!result.success) {
        this.fpError = 'Failed to resend OTP. Please try again.';
        return;
      }

      this.startResendCooldown();

    } catch (error: any) {
      this.fpError = 'Failed to resend OTP. Please try again.';
      console.error(error);
    } finally {
      this.fpLoading = false;
    }
  }

  // STEP 3 — Reset Password via Appwrite Function
  async resetPassword() {
    this.fpError = '';

    if (!this.fpNewPassword || !this.fpConfirmPassword) {
      this.fpError = 'Please fill in all fields.';
      return;
    }

    const passwordError = this.validateStrongPassword(this.fpNewPassword);
    if (passwordError) {
      this.fpError = passwordError;
      return;
    }

    if (this.fpNewPassword !== this.fpConfirmPassword) {
      this.fpError = 'Passwords do not match.';
      return;
    }

    this.fpLoading = true;

    try {
      // Check if new password is same as current
      try {
        const tempSession = await this.appwrite.account.createEmailPasswordSession(
          this.fpEmail,
          this.fpNewPassword
        );
        await this.appwrite.account.deleteSession(tempSession.$id);
        this.fpError   = 'You cannot reuse your current password. Please choose a different one.';
        this.fpLoading = false;
        return;
      } catch {
        // Passwords are different — safe to proceed
      }

      // Reset via Appwrite Function
      const execution = await this.appwrite.functions.createExecution(
        this.OTP_FUNCTION_ID,
        JSON.stringify({
          action:   'reset-password',
          userId:   this.fpUserId,
          password: this.fpNewPassword
        }),
        false
      );

      const result = JSON.parse(execution.responseBody);

      if (!result.success) {
        this.fpError = result.message || 'Failed to reset password.';
        return;
      }

      this.closeForgotPassword();

      Swal.fire({
        icon: 'success',
        title: 'Password Reset!',
        text: 'Your password has been changed. You can now log in.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true
      });

    } catch {
      this.fpError = 'Failed to reset password. Please try again.';
    } finally {
      this.fpLoading = false;
    }
  }

  startResendCooldown() {
    this.fpResendCooldown = 90;
    clearInterval(this.fpCooldownTimer);
    this.fpCooldownTimer = setInterval(() => {
      this.fpResendCooldown--;
      if (this.fpResendCooldown <= 0) clearInterval(this.fpCooldownTimer);
    }, 1000);
  }

  validateStrongPassword(password: string): string {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]=+;/']/.test(password)) return 'Password must contain at least one special character.';
    return '';
  }
}