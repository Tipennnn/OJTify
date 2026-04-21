import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppwriteService } from '../services/appwrite.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-intern-topnav',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './intern-topnav.component.html',
  styleUrls: ['./intern-topnav.component.css']
})
export class InternTopnavComponent implements OnInit, OnDestroy {

  menuOpen          = false;
  showPasswordModal = false;
  showCertModal     = false;

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

  profilePhotoUrl = 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff&size=128';

  // DateTime — Option D: muted date · bold time
  currentDayDate = '';
  currentTime    = '';
  private clockInterval: any;

  certData = {
    studentName:    'Juan Dela Cruz',
    school:         'Olongapo City Elementary School',
    course:         'Bachelor of Science in Information Technology',
    company:        'Olongapo City Elementary School',
    hoursCompleted: 500,
    requiredHours:  500,
    startDate:      'January 6, 2025',
    endDate:        'May 16, 2025',
    supervisorName: 'Maria Santos',
    supervisorPos:  'School Principal',
    dateIssued:     'May 16, 2025',
  };

  get hoursReached(): boolean {
    return this.certData.hoursCompleted >= this.certData.requiredHours;
  }

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(
    private router: Router,
    private appwrite: AppwriteService
  ) {}

  async ngOnInit() {
    this.appwrite.photoUrl$.subscribe(url => {
      this.profilePhotoUrl = url;
    });
    await this.loadProfilePhoto();

    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  /** Option D format: "Tue, Apr 21, 2026" (muted) · "6:25 PM" (bold) */
  private updateClock(): void {
    const now = new Date();

    const shortDays   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const day   = shortDays[now.getDay()];
    const month = shortMonths[now.getMonth()];
    const date  = now.getDate();
    const year  = now.getFullYear();

    // e.g. "Tue, Apr 21, 2026"
    this.currentDayDate = `${day}, ${month} ${date}, ${year}`;

    // 12-hour format — e.g. "6:25 PM"
    let hours  = now.getHours();
    const mins = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours      = hours % 12 || 12;
    this.currentTime = `${hours}:${mins} ${ampm}`;
  }

  async loadProfilePhoto() {
    try {
      const user = await this.appwrite.account.get();
      const res  = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      const docs = res.documents as any[];
      const doc  = docs.find(d => d.$id === user.$id);

      if (doc?.profile_photo_id) {
        const url = `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${doc.profile_photo_id}/view?project=${this.PROJECT_ID}`;
        this.profilePhotoUrl = url;
        this.appwrite.updateProfilePhoto(url);
      } else {
        const defaultUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2563eb&color=fff&size=128`;
        this.profilePhotoUrl = defaultUrl;
        this.appwrite.updateProfilePhoto(defaultUrl);
      }
    } catch {
      this.profilePhotoUrl = 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff&size=128';
    }
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  goProfile() {
    this.router.navigate(['/intern-profile']);
    this.menuOpen = false;
  }

  openChangePassword() {
    this.showPasswordModal = true;
    this.menuOpen          = false;
    this.currentPassword   = '';
    this.newPassword       = '';
    this.confirmPassword   = '';
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

  closeCertModal() { this.showCertModal = false; }

  openCertificate() {
    if (!this.hoursReached) {
      Swal.fire({
        icon: 'info',
        title: 'Not Yet Available',
        text: `You need to complete ${this.certData.requiredHours} hours first. You have ${this.certData.hoursCompleted} hrs so far.`,
        confirmButtonColor: '#2563eb'
      });
      this.menuOpen = false;
      return;
    }
    this.showCertModal = true;
    this.menuOpen      = false;
  }

  downloadCertificate() {
    const certEl = document.getElementById('certificate-preview');
    if (!certEl) return;

    const styles = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          return Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
        } catch {
          return sheet.href ? `@import url('${sheet.href}');` : '';
        }
      })
      .join('\n');

    const printWin = window.open('', '_blank', 'width=1,height=1,left=-9999,top=-9999');
    if (!printWin) {
      Swal.fire({
        icon: 'warning',
        title: 'Pop-up Blocked',
        text: 'Please allow pop-ups for this site to download the certificate.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Certificate_${this.certData.studentName.replace(/\s+/g, '_')}</title>
          <link rel="stylesheet"
                href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
          <link rel="stylesheet"
                href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap">
          <style>
            ${styles}
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            @page { size: A4 landscape; margin: 0; }
            @media print {
              body { margin: 0; background: white; }
              .certificate { box-shadow: none !important; }
            }
            body {
              margin: 0; padding: 0;
              display: flex; justify-content: center; align-items: center;
              min-height: 100vh; background: white; box-sizing: border-box;
            }
            .certificate { width: 100%; max-width: 100%; }
          </style>
        </head>
        <body>
          ${certEl.outerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() { window.close(); };
                setTimeout(function() { window.close(); }, 3000);
              }, 400);
            };
          <\/script>
        </body>
      </html>
    `);
    printWin.document.close();
  }

  async updatePassword() {
    this.pwError       = '';
    this.pwSuccess     = '';
    this.pwFieldErrors = { current: '', newPw: '', confirm: '' };

    let hasError = false;

    if (!this.currentPassword) {
      this.pwFieldErrors.current = 'Current password is required.';
      hasError = true;
    }

    if (!this.newPassword) {
      this.pwFieldErrors.newPw = 'New password is required.';
      hasError = true;
    } else {
      const strengthError = this.validateStrongPassword(this.newPassword);
      if (strengthError) {
        this.pwFieldErrors.newPw = strengthError;
        hasError = true;
      } else if (this.newPassword === this.currentPassword) {
        this.pwFieldErrors.newPw = 'New password must be different from current.';
        hasError = true;
      }
    }

    if (!this.confirmPassword) {
      this.pwFieldErrors.confirm = 'Please confirm your new password.';
      hasError = true;
    } else if (this.newPassword && this.confirmPassword !== this.newPassword) {
      this.pwFieldErrors.confirm = 'Passwords do not match.';
      hasError = true;
    }

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
        Swal.fire({
          icon: 'success',
          title: 'Password Updated!',
          text: 'Your password has been changed successfully.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      }, 1200);

    } catch (error: any) {
      const msg: string = error.message ?? '';
      if (msg.toLowerCase().includes('invalid credentials') ||
          msg.toLowerCase().includes('current') ||
          error.code === 401) {
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
    if (hour < 12) return 'Good Morning, Intern!';
    else if (hour < 18) return 'Good Afternoon, Intern!';
    else return 'Good Evening, Intern!';
  }

  validateStrongPassword(password: string): string {
    if (password.length < 8)
      return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password))
      return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password))
      return 'Password must contain at least one number.';
    if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]=+;/']/.test(password))
      return 'Password must contain at least one special character.';
    return '';
  }
}