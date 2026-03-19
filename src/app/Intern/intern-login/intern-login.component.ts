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
    this.loading      = true;

    try {
      // 1. Delete existing session if any
      try {
        await this.appwrite.account.deleteSession('current');
      } catch { }

      // 2. Sign in
      await this.appwrite.account.createEmailPasswordSession(
        this.email,
        this.password
      );

      // 3. Get current user
      const user = await this.appwrite.account.get();

      // 4. Check applicant status
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

      // 5. Check if they exist in students table (approved)
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

      // 6. All good — proceed to dashboard
      sessionStorage.removeItem('welcomeShown');
      this.router.navigate(['/intern-dashboard']);

    } catch (error: any) {
      this.errorMessage = error.message ?? 'Invalid email or password. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}