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

  // Account fields
  email        = '';
  password     = '';
  showPassword = false;

  // Personal info
  firstName     = '';
  middleName    = '';
  lastName      = '';
  contactNumber = '';
  birthday      = '';
  gender        = '';
  homeAddress   = '';

  // Academic
  studentId  = '';
  schoolName = '';
  course     = '';
  yearLevel  = '';

  // File uploads
  resumeFile      : File | null = null;
  endorsementFile : File | null = null;
  coeFile         : File | null = null;

  resumeFileName      = 'No file chosen';
  endorsementFileName = 'No file chosen';
  coeFileName         = 'No file chosen';

  // OTP step
  otpStep   = false;
  otpDigits = ['', '', '', '', '', ''];
  otpError  = '';

  private newUserId = '';

  // UI state
  loading        = false;
  errorMessage   = '';
  successMessage = '';

  readonly BUCKET_ID = '69baaf64002ceb2490df';

  constructor(private appwrite: AppwriteService) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onFileChange(event: Event, type: 'resume' | 'endorsement' | 'coe') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (type === 'resume') {
      this.resumeFile = file;
      this.resumeFileName = file?.name ?? 'No file chosen';
    } else if (type === 'endorsement') {
      this.endorsementFile = file;
      this.endorsementFileName = file?.name ?? 'No file chosen';
    } else {
      this.coeFile = file;
      this.coeFileName = file?.name ?? 'No file chosen';
    }
  }

  // STEP 1 — Create account + send OTP
  async onRegister() {
    this.errorMessage = '';
    this.loading = true;

    try {
      const user = await this.appwrite.account.create(
        ID.unique(),
        this.email,
        this.password,
        `${this.firstName} ${this.lastName}`
      );

      this.newUserId = user.$id;

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

  // OTP helpers
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

  // STEP 2 — Verify OTP, upload files, save profile
  async onVerifyOtp() {
    this.otpError = '';
    const token = this.otpDigits.join('');

    if (token.length < 6) {
      this.otpError = 'Please enter the complete 6-digit code.';
      return;
    }

    this.loading = true;

    try {
      // 1. Delete existing session if any
      try {
        await this.appwrite.account.deleteSession('current');
      } catch { }

      // 2. Verify OTP
      await this.appwrite.account.createSession(
        this.newUserId,
        token
      );

      // 3. Upload files to ojtify_files bucket
      let resumeFileId      = '';
      let endorsementFileId = '';
      let coeFileId         = '';

      if (this.resumeFile) {
        const res = await this.appwrite.storage.createFile(
          this.BUCKET_ID,
          ID.unique(),
          this.resumeFile
        );
        resumeFileId = res.$id;
      }

      if (this.endorsementFile) {
        const res = await this.appwrite.storage.createFile(
          this.BUCKET_ID,
          ID.unique(),
          this.endorsementFile
        );
        endorsementFileId = res.$id;
      }

      if (this.coeFile) {
        const res = await this.appwrite.storage.createFile(
          this.BUCKET_ID,
          ID.unique(),
          this.coeFile
        );
        coeFileId = res.$id;
      }

      // 4. Save profile to students table
      await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        this.newUserId,
        {
          first_name:          this.firstName,
          middle_name:         this.middleName,
          last_name:           this.lastName,
          email:               this.email,
          contact_number:      this.contactNumber,
          birthday:            this.birthday,
          gender:              this.gender,
          home_address:        this.homeAddress,
          student_id:          this.studentId,
          school_name:         this.schoolName,
          course:              this.course,
          year_level:          this.yearLevel,
          resume_file_id:      resumeFileId,
          endorsement_file_id: endorsementFileId,
          coe_file_id:         coeFileId
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