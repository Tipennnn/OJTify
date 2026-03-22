import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AppwriteService } from '../services/appwrite.service';
import { ID } from 'appwrite';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-intern-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './intern-profile.component.html',
  styleUrl: './intern-profile.component.css'
})
export class InternProfileComponent implements OnInit {

  loading      = false;
  saveLoading  = false;
  photoLoading = false;

  // 🔒 Read-only fields
  firstName  = '';
  middleName = '';
  lastName   = '';
  birthday   = '';
  gender     = '';
  studentId  = '';
  schoolName = '';
  course     = '';
  yearLevel  = '';

  // ✅ Editable fields
  contactNumber = '';
  email         = '';
  homeAddress   = '';

  // Profile photo
    profilePhotoUrl = 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff&size=128';
    profilePhotoId  = '';

  // Document file IDs
  resumeFileId       = '';
  endorsementFileId  = '';
  coeFileId          = '';

  private documentId = '';
  currentUserId      = '';

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(
    private router: Router,
    private appwrite: AppwriteService
  ) {}

  async ngOnInit() {
    await this.loadProfile();
  }

  async loadProfile() {
    this.loading = true;
    try {
      const user         = await this.appwrite.account.get();
      this.currentUserId = user.$id;
      this.email         = user.email;

      const res  = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );

      const docs = res.documents as any[];
      const doc  = docs.find(d => d.$id === this.currentUserId);

  if (doc) {
  this.documentId        = doc.$id;
  this.firstName         = doc.first_name       || '';
  this.middleName        = doc.middle_name      || '';
  this.lastName          = doc.last_name        || '';
  this.birthday          = doc.birthday         || '';
  this.gender            = doc.gender           || '';
  this.studentId         = doc.student_id       || '';
  this.schoolName        = doc.school_name      || '';
  this.course            = doc.course           || '';
  this.yearLevel         = doc.year_level       || '';
  this.contactNumber     = doc.contact_number   || '';
  this.homeAddress       = doc.home_address     || '';
  this.resumeFileId      = doc.resume_file_id       || '';
  this.endorsementFileId = doc.endorsement_file_id  || '';
  this.coeFileId         = doc.coe_file_id          || '';
  this.profilePhotoId    = doc.profile_photo_id     || '';

  if (this.profilePhotoId) {
    this.profilePhotoUrl = this.getFileUrl(this.profilePhotoId, 'view');
    this.appwrite.updateProfilePhoto(this.profilePhotoUrl);
  } else {
    // ── Use actual name for initials instead of "User" ──
    const name = `${this.firstName} ${this.lastName}`;
    this.profilePhotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=128`;
    this.appwrite.updateProfilePhoto(this.profilePhotoUrl);
  }
}

    } catch (error: any) {
      console.error('Failed to load profile:', error.message);
    } finally {
      this.loading = false;
    }
  }

  async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    if (!file) return;

    const reader  = new FileReader();
    reader.onload = (e) => {
      this.profilePhotoUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    this.photoLoading = true;

    try {
      if (this.profilePhotoId) {
        try {
          await this.appwrite.storage.deleteFile(this.BUCKET_ID, this.profilePhotoId);
        } catch { }
      }

      const uploaded = await this.appwrite.storage.createFile(
        this.BUCKET_ID, ID.unique(), file
      );

      this.profilePhotoId  = uploaded.$id;
      this.profilePhotoUrl = this.getFileUrl(uploaded.$id, 'view');

      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        this.documentId,
        { profile_photo_id: uploaded.$id }
      );

      this.appwrite.updateProfilePhoto(this.profilePhotoUrl);

      Swal.fire({
        icon: 'success',
        title: 'Photo Updated!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Upload Failed', text: error.message });
      this.profilePhotoUrl = this.profilePhotoId
        ? this.getFileUrl(this.profilePhotoId, 'view')
        : '/assets/images/default-profile.png';
    } finally {
      this.photoLoading = false;
    }
  }

  getFileUrl(fileId: string, mode: 'view' | 'download' = 'view'): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/${mode}?project=${this.PROJECT_ID}`;
  }

  async onSave() {
    if (!this.contactNumber || !this.homeAddress) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing fields',
        text: 'Please fill in contact number and home address.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    this.saveLoading = true;

    try {
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        this.documentId,
        {
          contact_number: this.contactNumber,
          home_address:   this.homeAddress
        }
      );

      this.appwrite.updateProfilePhoto(this.profilePhotoUrl);

      Swal.fire({
        icon: 'success',
        title: 'Profile Updated!',
        text: 'Your changes have been saved.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      }).then(() => {
        this.router.navigate(['/intern-dashboard']);
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Update Failed', text: error.message });
    } finally {
      this.saveLoading = false;
    }
  }

  goDashboard() {
    this.router.navigate(['/intern-dashboard']);
  }
}