import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

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
  fieldErrors = { email: '', password: '' };


  // ── Forgot password state ─────────────────────────────────
  forgotStep        = 0; // 0=hidden, 1=enter email, 2=enter OTP, 3=new password
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
  fpResendCooldown   = 0;
private fpCooldownTimer: any;

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
  this.fpEmail           = this.email;  // ← pre-fills from login field
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

  // STEP 1 — Send OTP via Brevo
  async sendOtp() {
  if (!this.fpEmail) {
    this.fpError = 'Please enter your email address.';
    return;
  }

  this.fpLoading = true;
  this.fpError   = '';

  try {
    // Check if email exists in students table
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL
    );

    const student = (res.documents as any[])
      .find(s => s.email === this.fpEmail);

    if (!student) {
      this.fpError   = 'No account found with this email address.';
      this.fpLoading = false;
      return;
    }

    this.fpUserName = `${student.first_name} ${student.last_name}`;
    this.fpUserId   = student.$id;

    // Generate 6-digit OTP
    this.fpOtp       = Math.floor(100000 + Math.random() * 900000).toString();
    this.fpOtpExpiry = Date.now() + (10 * 60 * 1000); // 10 minutes

    // Send OTP via Appwrite Function (no longer calls Brevo directly)
    const execution = await this.appwrite.functions.createExecution(
      '69e75aef0017bf366386',
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

  // ✅ OTP correct — go directly to step 3
  this.forgotStep = 3;
}

  async resendOtp() {
  this.fpEnteredOtp = '';
  this.fpError      = '';
  this.fpLoading    = true;

  try {
    this.fpOtp       = Math.floor(100000 + Math.random() * 900000).toString();
    this.fpOtpExpiry = Date.now() + (10 * 60 * 1000);

    const execution = await this.appwrite.functions.createExecution(
      '69e75aef0017bf366386',
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

  // STEP 3 — Reset Password via Appwrite recovery
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

    // ── Check if new password is same as current ──────────
    try {
      await this.appwrite.account.createEmailPasswordSession(
        this.fpEmail,
        this.fpNewPassword
      );
      await this.appwrite.account.deleteSession('current');
      this.fpError   = 'You cannot reuse your current password. Please choose a different one.';
      this.fpLoading = false;
      return;
    } catch {
      // Passwords are different, safe to proceed
    }
    // ─────────────────────────────────────────────────────

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

    // ── NEW: Block supervisors from logging in here ────────
    const supervisorRes = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.SUPERVISORS_COL
    );

    const isSupervisor = (supervisorRes.documents as any[])
      .some(s => s.$id === user.$id || s.auth_user_id === user.$id);

    if (isSupervisor) {
      await this.appwrite.account.deleteSession('current');
      this.errorMessage = 'This account is registered as a Supervisor. Please use the Supervisor portal to log in.';
      return;
    }
    // ── END: supervisor check ──────────────────────────────

    const applicantRes = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.APPLICANTS_COL
    );

    const applicant = (applicantRes.documents as any[])
      .find(a => a.auth_user_id === user.$id);

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

    const studentsRes = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL
    );

    const student = (studentsRes.documents as any[])
      .find(s => s.$id === user.$id);

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
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }

  if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]=+;/']/ .test(password)) {
    return 'Password must contain at least one special character.';
  }

  return ''; // no error
}
startResendCooldown() {
  this.fpResendCooldown = 90; // 1 min 30 secs
  clearInterval(this.fpCooldownTimer);
  this.fpCooldownTimer = setInterval(() => {
    this.fpResendCooldown--;
    if (this.fpResendCooldown <= 0) {
      clearInterval(this.fpCooldownTimer);
    }
  }, 1000);
}
}