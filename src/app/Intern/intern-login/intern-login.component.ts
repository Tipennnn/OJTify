import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment.example';

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

  togglePassword() {
    this.showPassword = !this.showPassword;
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
      this.fpOtp      = Math.floor(100000 + Math.random() * 900000).toString();
      this.fpOtpExpiry = Date.now() + (10 * 60 * 1000); // 10 minutes

      // Send OTP via Brevo
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': environment.brevoApiKey
        },
        body: JSON.stringify({
          sender: {
            name:  'OJTify Admin',
            email: 'adminojtify@gmail.com'
          },
          to: [{
            email: this.fpEmail,
            name:  this.fpUserName
          }],
          templateId: environment.brevoOtpTid,
          params: {
            user_name: this.fpUserName,
            otp_code:  this.fpOtp
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Brevo error:', err);
        this.fpError = 'Failed to send OTP. Please try again.';
        return;
      }

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

  resendOtp() {
    this.fpEnteredOtp = '';
    this.fpError      = '';
    this.forgotStep   = 1;
  }

  // STEP 3 — Reset Password via Appwrite recovery
 async resetPassword() {
  this.fpError = '';

  if (!this.fpNewPassword || !this.fpConfirmPassword) {
    this.fpError = 'Please fill in all fields.';
    return;
  }

  if (this.fpNewPassword.length < 8) {
    this.fpError = 'Password must be at least 8 characters.';
    return;
  }

  if (this.fpNewPassword !== this.fpConfirmPassword) {
    this.fpError = 'Passwords do not match.';
    return;
  }

  this.fpLoading = true;

  try {
    // Step 1 — create recovery token
    await this.appwrite.account.createRecovery(
      this.fpEmail,
      'http://localhost:4200/reset-password'
    );

    this.forgotStep = 0;
    this.fpLoading  = false;

    // Show instructions
    await Swal.fire({
      icon: 'info',
      title: 'One More Step!',
      html: `We sent a password reset link to <b>${this.fpEmail}</b>.<br><br>
             <span style="font-size:13px; color:#6b7280;">
               Check your inbox and click the link to set your new password:
               <br><br>
               <b style="color:#2563eb; font-size:16px;">${this.fpNewPassword}</b>
               <br><br>
               Copy the password above so you can paste it on the reset page!
             </span>`,
      confirmButtonColor: '#2563eb',
      confirmButtonText: 'Got it!'
    });

  } catch (error: any) {
    this.fpError = 'Failed to send reset link. Please try again.';
    this.fpLoading = false;
  }
}
  // ── LOGIN ─────────────────────────────────────────────────
  async onLogin() {
    this.errorMessage = '';
    this.loading      = true;

    try {
      try {
        await this.appwrite.account.deleteSession('current');
      } catch { }

      await this.appwrite.account.createEmailPasswordSession(
        this.email,
        this.password
      );

      const user = await this.appwrite.account.get();

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
      this.router.navigate(['/intern-dashboard']);

    } catch (error: any) {
      this.errorMessage = error.message ?? 'Invalid email or password. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}