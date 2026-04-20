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

  resumeFileName      = '';
  endorsementFileName = '';
  coeFileName         = '';

  // UI state
  loading        = false;
  errorMessage   = '';
  successMessage = '';

  // Field-level validation errors
  fieldErrors: Record<string, string> = {};

  // Track which fields have been touched (for blur validation)
  touched: Record<string, boolean> = {};

  readonly BUCKET_ID = '69baaf64002ceb2490df';

  constructor(private appwrite: AppwriteService) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onFileChange(event: Event, type: 'resume' | 'endorsement' | 'coe') {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;

    const maxSize = 5 * 1024 * 1024; // 5MB

    if (file && file.size > maxSize) {
      this.fieldErrors[type] = 'File must be under 5MB.';
      return;
    }

    delete this.fieldErrors[type];

    if (type === 'resume') {
      this.resumeFile     = file;
      this.resumeFileName = file?.name ?? '';
    } else if (type === 'endorsement') {
      this.endorsementFile     = file;
      this.endorsementFileName = file?.name ?? '';
    } else {
      this.coeFile     = file;
      this.coeFileName = file?.name ?? '';
    }
  }

  // ── FIELD VALIDATORS ──────────────────────────────────────

  private validateEmail(value: string): string {
    if (!value.trim()) return 'Email is required.';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(value)) return 'Enter a valid email address.';
    return '';
  }

  private validatePassword(value: string): string {
    if (!value) return 'Password is required.';
    if (value.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(value)) return 'Include at least one uppercase letter.';
    if (!/[0-9]/.test(value)) return 'Include at least one number.';
    if (!/[^A-Za-z0-9]/.test(value)) return 'Include at least one special character.';
    return '';
  }

  private validateContactNumber(value: string): string {
    if (!value.trim()) return 'Contact number is required.';
    const re = /^(\+639|09)\d{9}$/;
    if (!re.test(value.replace(/\s/g, '')))
      return 'Enter a valid PH number (e.g. 09XXXXXXXXX or +639XXXXXXXXX).';
    return '';
  }

  private validateBirthday(value: string): string {
    if (!value) return 'Birthday is required.';
    const dob = new Date(value);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    if (age < 13) return 'You must be at least 13 years old to register.';
    if (age > 100) return 'Please enter a valid birthday.';
    return '';
  }

  private validateRequired(value: string, label: string): string {
    return value.trim() ? '' : `${label} is required.`;
  }

  // Called on (blur) from the template
  onBlur(field: string) {
    this.touched[field] = true;
    this.validateField(field);
  }

  private validateField(field: string) {
    let error = '';
    switch (field) {
      case 'email':         error = this.validateEmail(this.email); break;
      case 'password':      error = this.validatePassword(this.password); break;
      case 'firstName':     error = this.validateRequired(this.firstName, 'First name'); break;
      case 'lastName':      error = this.validateRequired(this.lastName, 'Last name'); break;
      case 'contactNumber': error = this.validateContactNumber(this.contactNumber); break;
      case 'birthday':      error = this.validateBirthday(this.birthday); break;
      case 'gender':        error = this.validateRequired(this.gender, 'Gender'); break;
      case 'homeAddress':   error = this.validateRequired(this.homeAddress, 'Home address'); break;
      case 'studentId':     error = this.validateRequired(this.studentId, 'Student ID'); break;
      case 'schoolName':    error = this.validateRequired(this.schoolName, 'School name'); break;
      case 'course':        error = this.validateRequired(this.course, 'Course'); break;
      case 'yearLevel':     error = this.validateRequired(this.yearLevel, 'Year level'); break;
    }
    if (error) {
      this.fieldErrors[field] = error;
    } else {
      delete this.fieldErrors[field];
    }
  }

  // Run all validations at once and return true if the form is valid
  private validateAll(): boolean {
    const fields = [
      'email', 'password', 'firstName', 'lastName',
      'contactNumber', 'birthday', 'gender', 'homeAddress',
      'studentId', 'schoolName', 'course', 'yearLevel'
    ];
    fields.forEach(f => {
      this.touched[f] = true;
      this.validateField(f);
    });

    // File validations
    if (!this.resumeFile) this.fieldErrors['resume'] = 'Resume / CV is required.';
    if (!this.endorsementFile) this.fieldErrors['endorsement'] = 'Endorsement letter is required.';
    if (!this.coeFile) this.fieldErrors['coe'] = 'Certificate of enrollment is required.';

    return Object.keys(this.fieldErrors).length === 0;
  }

  // ── REGISTER ─────────────────────────────────────────────
  async onRegister() {
    this.errorMessage = '';

    if (!this.validateAll()) {
      this.errorMessage = 'Please fix the errors below before submitting.';
      return;
    }

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
      // Detect duplicate email
      if (error?.message?.toLowerCase().includes('already exists') ||
          error?.code === 409) {
        this.errorMessage = 'An account with this email already exists. Please log in instead.';
      } else {
        this.errorMessage = error.message ?? 'Registration failed. Please try again.';
      }
    } finally {
      this.loading = false;
    }
  }
}