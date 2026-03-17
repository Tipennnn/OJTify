import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-intern-register',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './intern-register.component.html',
  styleUrls: ['./intern-register.component.css']
})
export class InternRegisterComponent {

// Add these two properties near your other UI state fields
resendCooldown = 0;
private resendTimer: any = null;

  // ── Form fields ──────────────────────────────────────────────
  firstName     = '';
  middleName    = '';
  lastName      = '';
  email         = '';
  contactNumber = '';
  studentId     = '';
  password      = '';
  showPassword  = false;

  // ── OTP step ─────────────────────────────────────────────────
  otpStep   = false;
  otpDigits = ['', '', '', '', '', ''];
  otpError  = '';

  // ── UI state ─────────────────────────────────────────────────
  loading        = false;
  errorMessage   = '';
  successMessage = '';

  constructor(private supabase: SupabaseService) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  // ── STEP 1 — Submit registration form ────────────────────────
  async onRegister() {
    this.errorMessage = '';
    this.loading = true;

    const { error } = await this.supabase.client.auth.signUp({
      email: this.email,
      password: this.password,
      options: {
        data: {
          first_name:     this.firstName,
          middle_name:    this.middleName,
          last_name:      this.lastName,
          contact_number: this.contactNumber,
          student_id:     this.studentId
        }
      }
    });

    this.loading = false;

    if (error) {
      this.errorMessage = error.message;
      return;
    }

    // Supabase sends a 6-digit OTP to the email automatically
    this.otpStep = true;
  }

  // ── OTP box helpers ──────────────────────────────────────────
 onOtpInput(event: Event, index: number) {
  const input = event.target as HTMLInputElement;
  
  // Allow only a single digit (0-9)
  let val = input.value.replace(/[^0-9]/g, '').slice(-1);
  
  // Update the model
  this.otpDigits[index] = val;

  // Auto-advance focus to next box if digit entered
  if (val && index < 5) {
    // Use setTimeout to ensure the input has been processed
    setTimeout(() => {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }, 10);
  }
}

  onOtpKeydown(event: KeyboardEvent, index: number) {
    const input = event.target as HTMLInputElement;
    
    if (event.key === 'Backspace') {
      // If the current box is empty, move to previous box
      if (!this.otpDigits[index] && index > 0) {
        event.preventDefault();
        this.otpDigits[index - 1] = '';
        const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
        if (prevInput) {
          prevInput.focus();
          prevInput.value = '';
        }
      }
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
    
    // Update the model with pasted digits
    pasted.split('').forEach((ch, i) => {
      this.otpDigits[i] = ch;
    });
    
    // Focus on the last box or next empty box
    const lastFilled = Math.min(pasted.length, 5);
    setTimeout(() => {
      const focusBox = document.getElementById(`otp-${lastFilled}`) as HTMLInputElement;
      if (focusBox) {
        focusBox.focus();
      }
    }, 10);
  }

  // ── STEP 2 — Verify OTP ──────────────────────────────────────
  async onVerifyOtp() {
  this.otpError = '';
  const token = this.otpDigits.join('');

  if (token.length < 6) {
    this.otpError = 'Please enter the complete 6-digit code.';
    return;
  }

  this.loading = true;

  // 1. Verify the OTP
  const { data, error } = await this.supabase.client.auth.verifyOtp({
    email: this.email,
    token,
    type: 'signup'
  });

  if (error) {
    this.otpError = error.message;
    this.loading = false;
    return;
  }

  // 2. Insert profile into students table
  const { error: insertError } = await this.supabase.client
    .from('students')
    .insert({
      id:             data.user!.id,   // from the verified auth session
      first_name:     this.firstName,
      middle_name:    this.middleName,
      last_name:      this.lastName,
      email:          this.email,
      contact_number: this.contactNumber,
      student_id:     this.studentId
    });

  this.loading = false;

  if (insertError) {
    this.otpError = insertError.message;
    return;
  }

  this.otpStep = false;
  this.successMessage = 'Account verified! You can now log in.';
}

  // ── Resend OTP ───────────────────────────────────────────────
async resendOtp() {
  if (this.resendCooldown > 0) return;  // block if still cooling down

  this.otpError = '';
  this.loading = true;

  const { error } = await this.supabase.client.auth.resend({
    type: 'signup',
    email: this.email
  });

  this.loading = false;

  if (error) {
    // Give a user-friendly message for rate limit errors
    if (error.message.toLowerCase().includes('rate limit') || error.status === 429) {
      this.otpError = 'Too many attempts. Please wait a minute before requesting a new code.';
    } else {
      this.otpError = error.message;
    }
    return;
  }

  this.otpError = 'A new code has been sent to your email.';

  // Start a 60-second cooldown
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