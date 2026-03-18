import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { ID } from 'appwrite';

@Component({
  selector: 'app-intern-register',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './intern-register.component.html',
  styleUrls: ['./intern-register.component.css']
})
export class InternRegisterComponent {

  resendCooldown = 0;
  private resendTimer: any = null;

  // Form fields
  firstName     = '';
  middleName    = '';
  lastName      = '';
  email         = '';
  contactNumber = '';
  studentId     = '';
  password      = '';
  showPassword  = false;

  // OTP step
  otpStep   = false;
  otpDigits = ['', '', '', '', '', ''];
  otpError  = '';

  // Appwrite stores the userId after account creation
  private newUserId = '';

  // UI state
  loading        = false;
  errorMessage   = '';
  successMessage = '';

  constructor(private appwrite: AppwriteService) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  // STEP 1 — Create account + send OTP
  async onRegister() {
    this.errorMessage = '';
    this.loading = true;

    try {
      // 1. Create the auth account
      const user = await this.appwrite.account.create(
        ID.unique(),
        this.email,
        this.password,
        `${this.firstName} ${this.lastName}`
      );

      this.newUserId = user.$id;

      // 2. Send email verification (magic link or OTP depending on your Appwrite setup)
      //    For email OTP: create an email token session
      await this.appwrite.account.createEmailToken(
        this.newUserId,
        this.email
      );

      this.otpStep = true;

    } catch (error: any) {
      this.errorMessage = error.message ?? 'Registration failed. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  // OTP box helpers — no changes needed
  onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/[^0-9]/g, '').slice(-1);
    this.otpDigits[index] = val;

    if (val && index < 5) {
      setTimeout(() => {
        const next = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
        if (next) { next.focus(); next.select(); }
      }, 10);
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      event.preventDefault();
      this.otpDigits[index - 1] = '';
      const prev = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
      if (prev) { prev.focus(); (prev as any).value = ''; }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      (document.getElementById(`otp-${index - 1}`) as HTMLInputElement)?.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      (document.getElementById(`otp-${index + 1}`) as HTMLInputElement)?.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text').replace(/[^0-9]/g, '').slice(0, 6) ?? '';
    pasted.split('').forEach((ch, i) => { this.otpDigits[i] = ch; });
    const lastFilled = Math.min(pasted.length, 5);
    setTimeout(() => {
      (document.getElementById(`otp-${lastFilled}`) as HTMLInputElement)?.focus();
    }, 10);
  }

  // STEP 2 — Verify OTP and save profile
async onVerifyOtp() {
  this.otpError = '';
  const token = this.otpDigits.join('');

  if (token.length < 6) {
    this.otpError = 'Please enter the complete 6-digit code.';
    return;
  }

  this.loading = true;

  try {
    // 1. Delete any existing session first to avoid conflict
    try {
      await this.appwrite.account.deleteSession('current');
    } catch {
      // No active session, that's fine
    }

    // 2. Confirm the OTP — this creates a session
    await this.appwrite.account.createSession(
      this.newUserId,
      token
    );

    // 3. Save profile to your Appwrite database table
    await this.appwrite.databases.createDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL,
      this.newUserId,
      {
        first_name:     this.firstName,
        middle_name:    this.middleName,
        last_name:      this.lastName,
        email:          this.email,
        contact_number: this.contactNumber,
        student_id:     this.studentId
      }
    );

    this.otpStep = false;
    this.successMessage = 'Account verified! You can now log in.';

  } catch (error: any) {
    this.otpError = error.message ?? 'Verification failed. Please try again.';
  } finally {
    this.loading = false;
  }
}
  // Resend OTP
  async resendOtp() {
    if (this.resendCooldown > 0) return;

    this.otpError = '';
    this.loading = true;

    try {
      await this.appwrite.account.createEmailToken(
        this.newUserId,
        this.email
      );
      this.otpError = 'A new code has been sent to your email.';
      this.startResendCooldown();
    } catch (error: any) {
      this.otpError = error.message ?? 'Failed to resend code.';
    } finally {
      this.loading = false;
    }
  }

  private startResendCooldown() {
    this.resendCooldown = 60;
    this.resendTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.resendTimer);
        this.resendCooldown = 0;
      }
    }, 1000);
  }
}