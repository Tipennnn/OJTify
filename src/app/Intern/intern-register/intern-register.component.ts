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
    const file  = input.files?.[0] ?? null;
    if (type === 'resume') {
      this.resumeFile     = file;
      this.resumeFileName = file?.name ?? 'No file chosen';
    } else if (type === 'endorsement') {
      this.endorsementFile     = file;
      this.endorsementFileName = file?.name ?? 'No file chosen';
    } else {
      this.coeFile     = file;
      this.coeFileName = file?.name ?? 'No file chosen';
    }
  }

  // ── REGISTER — save to applicants table, no OTP ───────────
  async onRegister() {
    this.errorMessage   = '';
    this.successMessage = '';
    this.loading        = true;

    try {
      // 1. Create auth account
      const user = await this.appwrite.account.create(
        ID.unique(),
        this.email,
        this.password,
        `${this.firstName} ${this.lastName}`
      );

      // 2. Upload files
      let resumeFileId      = '';
      let endorsementFileId = '';
      let coeFileId         = '';

      if (this.resumeFile) {
        const res = await this.appwrite.storage.createFile(
          this.BUCKET_ID, ID.unique(), this.resumeFile
        );
        resumeFileId = res.$id;
      }

      if (this.endorsementFile) {
        const res = await this.appwrite.storage.createFile(
          this.BUCKET_ID, ID.unique(), this.endorsementFile
        );
        endorsementFileId = res.$id;
      }

      if (this.coeFile) {
        const res = await this.appwrite.storage.createFile(
          this.BUCKET_ID, ID.unique(), this.coeFile
        );
        coeFileId = res.$id;
      }

      // 3. Save to applicants table with status = pending
     await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.APPLICANTS_COL,
        user.$id,
        {
          auth_user_id:        user.$id,
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
          coe_file_id:         coeFileId,
          status:              'pending'
        }
      );

      // 4. Sign out immediately — they can't use the app yet
      try {
        await this.appwrite.account.deleteSession('current');
      } catch { }

      this.successMessage = 'pending';

    } catch (error: any) {
      this.errorMessage = error.message ?? 'Registration failed. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}