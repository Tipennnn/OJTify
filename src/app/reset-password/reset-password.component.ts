import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AppwriteService } from '../services/appwrite.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {

  newPassword     = '';
  confirmPassword = '';
  showNew         = false;
  showConfirm     = false;
  loading         = false;
  errorMessage    = '';
  validLink       = false;

  private userId = '';
  private secret = '';

  constructor(
    private appwrite: AppwriteService,
    private route   : ActivatedRoute,
    private router  : Router
  ) {}

 ngOnInit() {
  this.userId = this.route.snapshot.queryParamMap.get('userId') || '';
  this.secret = this.route.snapshot.queryParamMap.get('secret') || '';

  if (this.userId && this.secret) {
    this.validLink = true;   // ✅ came from email link — show password form
  } else {
    this.validLink    = false;
    this.errorMessage = 'Please check your email and click the reset link to continue.';
  }
}

  async onResetPassword() {
    this.errorMessage = '';

    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.loading = true;

    try {
      await this.appwrite.account.updateRecovery(
        this.userId,
        this.secret,
        this.newPassword
      );

      await Swal.fire({
        icon: 'success',
        title: 'Password Reset!',
        text: 'Your password has been changed. You can now log in with your new password.',
        confirmButtonColor: '#2563eb'
      });

      this.router.navigate(['/intern-login']);

    } catch (error: any) {
      this.errorMessage = 'This reset link has expired. Please request a new one.';
    } finally {
      this.loading = false;
    }
  }
}