import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';
import { Query } from 'appwrite';

@Component({
  selector: 'app-intern-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './intern-login.component.html',
  styleUrls: ['./intern-login.component.css']
})
export class InternLoginComponent implements OnInit, OnDestroy {

  email        = '';
  password     = '';
  rememberMe   = false;
  showPassword = false;
  loading      = false;
  errorMessage = '';
  fieldErrors  = { email: '', password: '' };

  // ── Forgot password state ─────────────────────────────────
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

  // ── REPLACE THIS with your new function ID after deploying ─
  private readonly OTP_FUNCTION_ID = '69edb8fb00176781c74b';

  constructor(
    private appwrite: AppwriteService,
    private router  : Router
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

  ngOnDestroy() {
    clearInterval(this.fpCooldownTimer);
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
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

  // STEP 1 — Send OTP via Appwrite Function
  async sendOtp() {
  const email = this.fpEmail.trim().toLowerCase();

  if (!email) {
    this.fpError = 'Please enter your email address.';
    return;
  }

  this.fpLoading = true;
  this.fpError   = '';

  try {
    const execution = await this.appwrite.functions.createExecution(
      this.OTP_FUNCTION_ID,
      JSON.stringify({
        action:       'send-otp-student',
        email,
        templateId:   environment.brevoOtpTid,
        databaseId:   this.appwrite.DATABASE_ID,
        collectionId: this.appwrite.STUDENTS_COL
      }),
      false
    );

    const result = JSON.parse(execution.responseBody);

    if (!result.success) {
      this.fpError = result.message || 'Failed to send OTP. Please try again.';
      return;
    }

    this.fpEmail     = email;
    this.fpUserId    = result.userId;
    this.fpUserName  = result.userName;
    this.fpOtp       = result.otp;
    this.fpOtpExpiry = Date.now() + (10 * 60 * 1000);

    this.startResendCooldown();
    this.forgotStep = 2;

  } catch (error: any) {
    this.fpError = 'Failed to send OTP. Please try again.';
    console.error(error);
  } finally {
    this.fpLoading = false;
  }
}

  // STEP 2 — Verify OTP
  verifyOtp() {
    this.fpError = '';

    if (!this.fpEnteredOtp) {
      this.fpError = 'Please enter the OTP code.';
      return;
    }

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
  this.fpEnteredOtp = '';
  this.fpError      = '';
  this.fpLoading    = true;

  try {
    const execution = await this.appwrite.functions.createExecution(
      this.OTP_FUNCTION_ID,
      JSON.stringify({
        action:       'send-otp-student',
        email:        this.fpEmail,
        templateId:   environment.brevoOtpTid,
        databaseId:   this.appwrite.DATABASE_ID,
        collectionId: this.appwrite.STUDENTS_COL
      }),
      false
    );

    const result = JSON.parse(execution.responseBody);

    if (!result.success) {
      this.fpError = result.message || 'Failed to resend OTP. Please try again.';
      return;
    }

    this.fpOtp       = result.otp;
    this.fpOtpExpiry = Date.now() + (10 * 60 * 1000);
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
        // If login succeeded, passwords are the same
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

    } catch (error: any) {
      this.fpError = 'Failed to reset password. Please try again.';
    } finally {
      this.fpLoading = false;
    }
  }

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
    const user = await this.appwrite.account.get();

    // ── 1. Supervisor check ──────────────────────────────
    let isSupervisor = false;
    try {
      await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL,
        user.$id
      );
      isSupervisor = true;
    } catch { /* not found by $id */ }

    if (!isSupervisor) {
      try {
        const res = await this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.SUPERVISORS_COL,
          [Query.equal('auth_user_id', user.$id), Query.limit(1)]
        );
        isSupervisor = res.total > 0;
      } catch { /* no access / no index → treat as not supervisor */ }
    }

    if (isSupervisor) {
      await this.appwrite.account.deleteSession('current');
      this.errorMessage = 'This account is registered as a Supervisor. Please use the Supervisor portal to log in.';
      return;
    }

    // ── 2. Applicant status check ────────────────────────
    let applicant: any = null;
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.APPLICANTS_COL,
        [Query.equal('auth_user_id', user.$id), Query.limit(1)]
      );
      applicant = res.documents[0] ?? null;
    } catch (e) {
      console.warn('Applicant lookup failed:', e);
    }

    if (applicant) {
      if (applicant.status === 'pending') {
        await this.appwrite.account.deleteSession('current');
        this.errorMessage = 'Your application is still pending admin approval.';
        return;
      }
      if (applicant.status === 'declined') {
        await this.appwrite.account.deleteSession('current');
        this.errorMessage = 'Your application has been declined. Please contact the admin.';
        return;
      }
    }

    // ── 3. Student document (direct fetch by ID) ─────────
    let student: any = null;
    try {
      student = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        user.$id
      );
    } catch (e: any) {
      console.warn('Student lookup failed:', e?.code, e?.message);
    }

    if (!student) {
      await this.appwrite.account.deleteSession('current');
      this.errorMessage = 'Your account is not yet approved. Please wait for admin approval.';
      return;
    }

    sessionStorage.removeItem('welcomeShown');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('profilePhotoReminderShown');
    sessionStorage.removeItem('profileAlertShown');
    sessionStorage.setItem('role', 'intern');
    sessionStorage.setItem('currentDocId', student.$id);
    this.router.navigate(['/intern-dashboard']);

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

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('fp-overlay')) {
      this.closeForgotPassword();
    }
  }

  validateStrongPassword(password: string): string {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]=+;/']/.test(password)) return 'Password must contain at least one special character.';
    return '';
  }

  startResendCooldown() {
    this.fpResendCooldown = 90;
    clearInterval(this.fpCooldownTimer);
    this.fpCooldownTimer = setInterval(() => {
      this.fpResendCooldown--;
      if (this.fpResendCooldown <= 0) clearInterval(this.fpCooldownTimer);
    }, 1000);
  }
}