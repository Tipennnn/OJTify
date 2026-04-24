import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-supervisor-topnav',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supervisor-topnav.component.html',
  styleUrls: ['./supervisor-topnav.component.css']
})
export class SupervisorTopnavComponent implements OnInit, OnDestroy {

  menuOpen          = false;
  showPasswordModal = false;

  showCurrent = false;
  showNew     = false;
  showConfirm = false;

  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  passwordLoading = false;

  pwError       = '';
  pwSuccess     = '';
  pwFieldErrors = { current: '', newPw: '', confirm: '' };

  profilePhotoUrl = 'https://ui-avatars.com/api/?name=Supervisor&background=0818A8&color=fff&size=128';

  // Profile Modal
  showProfileModal  = false;
  profileLoading    = false;
  profileSaving     = false;
  profileError      = '';
  profileSuccess    = '';

  // Photo upload
  photoUploading   = false;
  photoPreviewUrl  = '';

  profileForm = {
    first_name  : '',
    last_name   : '',
    email       : '',
    employee_id : '',
    grade_level : '',
  };

  // E-Signature
  esigPreviewUrl = '';
  esigUploading  = false;
  currentDoc: any = null;

  // DateTime
  currentDayDate = '';
  currentTime    = '';
  private clockInterval: any;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(
    private router: Router,
    private appwrite: AppwriteService
  ) {}

  async ngOnInit() {
  await this.loadProfilePhoto();
  this.updateClock();
  this.clockInterval = setInterval(() => this.updateClock(), 1000);
  // ← ADD THIS
  window.addEventListener('open-esig-upload', this.esigUploadListener);
}

ngOnDestroy() {
  if (this.clockInterval) clearInterval(this.clockInterval);
  // ← ADD THIS
  window.removeEventListener('open-esig-upload', this.esigUploadListener);
}


  private updateClock(): void {
    const now = new Date();
    const shortDays   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    this.currentDayDate = `${shortDays[now.getDay()]}, ${shortMonths[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    let hours  = now.getHours();
    const mins = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    this.currentTime = `${hours}:${mins} ${ampm}`;
  }

  async loadProfilePhoto() {
    try {
      const user = await this.appwrite.account.get();
      const res  = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL
      );
      const doc = (res.documents as any[]).find(d => d.$id === user.$id);
      this.currentDoc = doc || null;

      if (doc?.profile_photo_id) {
        this.profilePhotoUrl = `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${doc.profile_photo_id}/view?project=${this.PROJECT_ID}`;
      } else {
        this.profilePhotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Supervisor')}&background=0818A8&color=fff&size=128`;
      }
    } catch {
      this.profilePhotoUrl = 'https://ui-avatars.com/api/?name=Supervisor&background=0818A8&color=fff&size=128';
    }
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  async goProfile() {
    this.menuOpen         = false;
    this.profileError     = '';
    this.profileSuccess   = '';
    this.esigPreviewUrl   = '';
    this.photoPreviewUrl  = '';
    this.profileLoading   = true;
    this.showProfileModal = true;

    try {
      const user = await this.appwrite.account.get();
      const res  = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL
      );
      const doc = (res.documents as any[]).find(d => d.$id === user.$id);
      this.currentDoc = doc || null;

      this.profileForm = {
        first_name  : doc?.first_name   || user.name?.split(' ')[0] || '',
        last_name   : doc?.last_name    || user.name?.split(' ')[1] || '',
        email       : doc?.email        || user.email || '',
        employee_id : doc?.employee_id  || '',
        grade_level : doc?.grade_level  || '',
      };

      this.photoPreviewUrl = this.profilePhotoUrl;

      if (doc?.esig_file_id) {
        await this.loadEsigPreview(doc.esig_file_id);
      }
    } catch (err: any) {
      this.profileError = 'Failed to load profile data.';
    } finally {
      this.profileLoading = false;
    }
  }

  closeProfileModal() {
    this.showProfileModal = false;
    this.profileError     = '';
    this.profileSuccess   = '';
    this.esigPreviewUrl   = '';
    this.photoPreviewUrl  = '';
  }

  // ── Employee ID: alphanumeric + hyphens only, max 20 chars ──
  onEmployeeIdInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/[^a-zA-Z0-9\-]/g, '');
    if (val.length > 20) val = val.substring(0, 20);
    this.profileForm.employee_id = val;
    input.value = val;
  }

  // ── Profile Photo Upload ──
  async onPhotoChange(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    Swal.fire({ icon: 'error', title: 'Invalid File Type', text: 'Please upload a JPG, PNG, or WEBP image.', confirmButtonColor: '#0818A8' });
    (event.target as HTMLInputElement).value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    Swal.fire({ icon: 'error', title: 'File Too Large', text: 'Profile photo must be less than 5MB.', confirmButtonColor: '#0818A8' });
    (event.target as HTMLInputElement).value = '';
    return;
  }

  this.photoUploading = true;
  try {
    const user = await this.appwrite.account.get();

    // Delete old photo if exists
    const oldPhotoId = this.currentDoc?.profile_photo_id;
    if (oldPhotoId) {
      try { await this.appwrite.storage.deleteFile(this.BUCKET_ID, oldPhotoId); } catch {}
    }

    const { ID } = await import('appwrite');
    const newFileId = ID.unique();
    await this.appwrite.storage.createFile(this.BUCKET_ID, newFileId, file);

    await this.appwrite.databases.updateDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.SUPERVISORS_COL,
      user.$id,
      { profile_photo_id: newFileId }
    );

    if (this.currentDoc) this.currentDoc.profile_photo_id = newFileId;

    // Build the Appwrite URL directly (more reliable than FileReader for topnav)
    const newPhotoUrl = `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${newFileId}/view?project=${this.PROJECT_ID}`;
    this.profilePhotoUrl = newPhotoUrl;
    this.photoPreviewUrl = newPhotoUrl;

    // Reset file input
    (event.target as HTMLInputElement).value = '';

    Swal.fire({ icon: 'success', title: 'Photo Updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });

  } catch (err: any) {
    Swal.fire({ icon: 'error', title: 'Upload Failed', text: err.message, confirmButtonColor: '#0818A8' });
  } finally {
    this.photoUploading = false;
  }
}

  async saveProfile() {
  this.profileError   = '';
  this.profileSuccess = '';

  this.profileSaving = true;
  try {
    const user = await this.appwrite.account.get();
    await this.appwrite.databases.updateDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.SUPERVISORS_COL,
      user.$id,
      {
        employee_id : this.profileForm.employee_id.trim(),
        grade_level : this.profileForm.grade_level,
      }
    );

    await this.loadProfilePhoto();
    this.profileSuccess = 'Profile updated successfully!';

    setTimeout(() => {
      this.closeProfileModal();
      Swal.fire({ icon: 'success', title: 'Profile Updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    }, 1200);

  } catch (err: any) {
    this.profileError = err.message || 'Failed to save profile.';
  } finally {
    this.profileSaving = false;
  }
}

  // ── E-Signature ──
  async onEsigChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.type !== 'image/png') {
      Swal.fire({ icon: 'error', title: 'Invalid File Type', text: 'Only PNG files are accepted for e-signatures.', confirmButtonColor: '#0818A8' });
      (event.target as HTMLInputElement).value = '';
      return;
    }
    await this.uploadEsig(file);
  }

  async onEsigDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.type !== 'image/png') {
      Swal.fire({ icon: 'error', title: 'Invalid File Type', text: 'Only PNG files are accepted for e-signatures.', confirmButtonColor: '#0818A8' });
      return;
    }
    await this.uploadEsig(file);
  }

  private async uploadEsig(file: File): Promise<void> {
    if (file.type !== 'image/png') return;
    this.esigUploading = true;
    try {
      const user = await this.appwrite.account.get();
      const oldFileId = this.currentDoc?.esig_file_id;
      if (oldFileId) {
        try { await this.appwrite.storage.deleteFile(this.BUCKET_ID, oldFileId); } catch {}
      }
      const { ID } = await import('appwrite');
      const newFileId = ID.unique();
      await this.appwrite.storage.createFile(this.BUCKET_ID, newFileId, file);
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID, this.appwrite.SUPERVISORS_COL, user.$id, { esig_file_id: newFileId }
      );
      if (this.currentDoc) this.currentDoc.esig_file_id = newFileId;
      const reader = new FileReader();
      reader.onloadend = () => { this.esigPreviewUrl = reader.result as string; };
      reader.readAsDataURL(file);
      Swal.fire({ icon: 'success', title: 'E-Signature Saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Upload Failed', text: err.message, confirmButtonColor: '#0818A8' });
    } finally {
      this.esigUploading = false;
    }
  }

  async removeEsig(): Promise<void> {
    if (!this.currentDoc?.esig_file_id) return;
    try { await this.appwrite.storage.deleteFile(this.BUCKET_ID, this.currentDoc.esig_file_id); } catch {}
    const user = await this.appwrite.account.get();
    await this.appwrite.databases.updateDocument(
      this.appwrite.DATABASE_ID, this.appwrite.SUPERVISORS_COL, user.$id, { esig_file_id: '' }
    );
    if (this.currentDoc) this.currentDoc.esig_file_id = '';
    this.esigPreviewUrl = '';
  }

  private async loadEsigPreview(fileId: string): Promise<void> {
    try {
      const jwt = await this.appwrite.account.createJWT();
      const url = `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=${this.PROJECT_ID}`;
      const res = await fetch(url, { headers: { 'X-Appwrite-JWT': jwt.jwt, 'X-Appwrite-Project': this.PROJECT_ID } });
      if (res.ok) {
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => { this.esigPreviewUrl = reader.result as string; };
        reader.readAsDataURL(blob);
      }
    } catch (err) { console.warn('Could not load esig preview:', err); }
  }

  // ── Change Password ──
  openChangePassword() {
    this.showPasswordModal = true;
    this.menuOpen          = false;
    this.currentPassword   = '';
    this.newPassword       = '';
    this.confirmPassword   = '';
    this.pwError           = '';
    this.pwSuccess         = '';
    this.pwFieldErrors     = { current: '', newPw: '', confirm: '' };
  }

  closeModal() {
    this.showPasswordModal = false;
    this.currentPassword   = '';
    this.newPassword       = '';
    this.confirmPassword   = '';
    this.pwError           = '';
    this.pwSuccess         = '';
    this.pwFieldErrors     = { current: '', newPw: '', confirm: '' };
  }

  async updatePassword() {
    this.pwError       = '';
    this.pwSuccess     = '';
    this.pwFieldErrors = { current: '', newPw: '', confirm: '' };
    let hasError = false;
    if (!this.currentPassword) { this.pwFieldErrors.current = 'Current password is required.'; hasError = true; }
    if (!this.newPassword) {
      this.pwFieldErrors.newPw = 'New password is required.'; hasError = true;
    } else {
      const strengthError = this.validateStrongPassword(this.newPassword);
      if (strengthError) { this.pwFieldErrors.newPw = strengthError; hasError = true; }
      else if (this.newPassword === this.currentPassword) { this.pwFieldErrors.newPw = 'New password must be different from current.'; hasError = true; }
    }
    if (!this.confirmPassword) { this.pwFieldErrors.confirm = 'Please confirm your new password.'; hasError = true; }
    else if (this.newPassword && this.confirmPassword !== this.newPassword) { this.pwFieldErrors.confirm = 'Passwords do not match.'; hasError = true; }
    if (hasError) return;

    this.passwordLoading = true;
    try {
      await this.appwrite.account.updatePassword(this.newPassword, this.currentPassword);
      this.pwSuccess       = 'Password updated successfully!';
      this.currentPassword = '';
      this.newPassword     = '';
      this.confirmPassword = '';
      setTimeout(() => {
        this.closeModal();
        Swal.fire({ icon: 'success', title: 'Password Updated!', text: 'Your password has been changed successfully.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
      }, 1200);
    } catch (error: any) {
      const msg: string = error.message ?? '';
      if (msg.toLowerCase().includes('invalid credentials') || msg.toLowerCase().includes('current') || error.code === 401) {
        this.pwFieldErrors.current = 'Current password is incorrect.';
      } else {
        this.pwError = 'Failed to update password. Please try again.';
      }
    } finally {
      this.passwordLoading = false;
    }
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning, Supervisor!';
    else if (hour < 18) return 'Good Afternoon, Supervisor!';
    else return 'Good Evening, Supervisor!';
  }

  validateStrongPassword(password: string): string {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]=+;/']/.test(password)) return 'Password must contain at least one special character.';
    return '';
  }
  private esigUploadListener = () => this.goProfileAndOpenEsig();
  
  private async goProfileAndOpenEsig(): Promise<void> {
  await this.goProfile(); // opens the profile modal with all data loaded
  // Give it a moment to render, then trigger the esig input click
  setTimeout(() => {
    const esigInput = document.querySelector('input[accept="image/png"]') as HTMLInputElement;
    if (esigInput) esigInput.click();
  }, 600);
}

}