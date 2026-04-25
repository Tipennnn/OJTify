import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppwriteService } from '../services/appwrite.service';
import { Query } from 'appwrite';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as QRCode from 'qrcode';

interface CertTemplate {
  requiredHours:     number;
  republic:          string;
  department:        string;
  division:          string;
  schoolName:        string;
  hostSchool:        string;
  address:           string;
  mainTitle:         string;
  subtitleTag:       string;
  awardedText:       string;
  bodyText:          string;
  givenText:         string;
  supervisorName:    string;
  supervisorPos:     string;
  leftSignatoryName: string;
  leftSignatoryPos:  string;
  issuedLocation:    string;
  primaryColor:      string;
  accentColor:       string;
  depedLogoUrl:      string;
  schoolLogoUrl:     string;
  watermarkUrl:      string;
  leftSigUrl:        string;
  rightSigUrl:       string;
}

const DEFAULT_TEMPLATE: CertTemplate = {
  requiredHours:     500,
  republic:          'Republic of the Philippines',
  department:        'Department of Education',
  division:          'Schools Division of Olongapo City',
  schoolName:        'Olongapo City Elementary School',
  hostSchool:        'Olongapo City Elementary School',
  address:           'Olongapo City, Zambales',
  mainTitle:         'Certificate of Completion',
  subtitleTag:       'On-the-Job Training Program',
  awardedText:       'This certificate is proudly awarded to',
  bodyText:          'for successfully completing the {hours}-hour On-the-Job Training (OJT), taking up {course} from {school}, conducted at {host}.',
  givenText:         'Given this {date}, at {location}.',
  supervisorName:    'Maria Santos',
  supervisorPos:     'OJT Supervisor',
  leftSignatoryName: 'Juan Dela Cruz',
  leftSignatoryPos:  'School Principal',
  issuedLocation:    'Olongapo City Elementary School',
  primaryColor:      '#1e3a8a',
  accentColor:       '#c9a84c',
  depedLogoUrl:      '',
  schoolLogoUrl:     '',
  watermarkUrl:      '',
  leftSigUrl:        '',
  rightSigUrl:       '',
};

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
  isDownloading     = false;

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

  currentDayDate = '';
  currentTime    = '';
  private clockInterval: any;

  certSentByAdmin = false;

  certTemplate: CertTemplate = { ...DEFAULT_TEMPLATE };

  // ── Per-intern supervisor e-sig (base64) loaded from Appwrite Storage ──
  supervisorRightSigBase64 = '';
  supervisorName           = '';
  supervisorPos            = '';

  certData = {
    studentName:    '',
    school:         '',
    course:         '',
    hoursCompleted: 0,
    requiredHours:  500,
    startDate:      '',
    endDate:        '',
    dateIssued:     '',
  };

  certQrDataUrl = '';
certVerificationId = '';

  get hoursReached(): boolean {
    return this.certSentByAdmin;
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

    await this.loadCertTemplate();
    await this.loadInternData();

    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  // ── Download an Appwrite Storage file as base64 using JWT (no CORS issues) ──
  private async appwriteFileToBase64(fileId: string): Promise<string> {
    if (!fileId) return '';
    if (fileId.startsWith('data:')) return fileId;

    try {
      const jwt = await this.appwrite.account.createJWT();
      const url = `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=${this.PROJECT_ID}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Appwrite-JWT':     jwt.jwt,
          'X-Appwrite-Project': this.PROJECT_ID,
        },
      });

      if (!response.ok) {
        console.warn(`appwriteFileToBase64: ${response.status} for fileId=${fileId}`);
        return '';
      }

      const blob = await response.blob();
      return await this.blobToBase64(blob);

    } catch (err) {
      console.warn('appwriteFileToBase64 failed:', err);
      return '';
    }
  }

  // ── Convert any Blob/File to base64 data URL ──
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror   = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ── Load cert template from DB, converting file IDs → base64 ──
  private async loadCertTemplate(): Promise<void> {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ADMINS_COL,
        [Query.limit(1)]
      );

      const adminDoc: any = res.documents[0] ?? null;

      if (adminDoc?.cert_template_json) {
        const parsed = JSON.parse(adminDoc.cert_template_json);

        const depedFileId     = adminDoc.cert_deped_logo_url  || '';
        const schoolFileId    = adminDoc.cert_school_logo_url || '';
        const watermarkFileId = adminDoc.cert_watermark_url   || '';
        const leftSigFileId   = adminDoc.cert_left_sig_url    || '';
        // NOTE: rightSigUrl in the template is the GLOBAL supervisor sig.
        //       The per-intern supervisor sig is loaded in loadInternData().
        const rightSigFileId  = adminDoc.cert_right_sig_url   || '';

        const [depedB64, schoolB64, watermarkB64, leftSigB64, rightSigB64] = await Promise.all([
          this.appwriteFileToBase64(depedFileId),
          this.appwriteFileToBase64(schoolFileId),
          this.appwriteFileToBase64(watermarkFileId),
          this.appwriteFileToBase64(leftSigFileId),
          this.appwriteFileToBase64(rightSigFileId),
        ]);

        parsed.depedLogoUrl  = depedB64;
        parsed.schoolLogoUrl = schoolB64;
        parsed.watermarkUrl  = watermarkB64;
        parsed.leftSigUrl    = leftSigB64;
        parsed.rightSigUrl   = rightSigB64;

        this.certTemplate = { ...DEFAULT_TEMPLATE, ...parsed };
        return;
      }
    } catch (err) {
      console.warn('Could not load cert template from DB:', err);
    }

    this.certTemplate = { ...DEFAULT_TEMPLATE };
  }

  private updateClock(): void {
    const now = new Date();
    const shortDays   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day   = shortDays[now.getDay()];
    const month = shortMonths[now.getMonth()];
    const date  = now.getDate();
    const year  = now.getFullYear();
    this.currentDayDate = `${day}, ${month} ${date}, ${year}`;
    let hours  = now.getHours();
    const mins = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours      = hours % 12 || 12;
    this.currentTime = `${hours}:${mins} ${ampm}`;
  }

  async loadInternData() {
    try {
      const user = await this.appwrite.account.get();

      const res  = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      const docs = res.documents as any[];
      const doc  = docs.find(d => d.$id === user.$id);

      if (doc) {
        // ── Profile photo ──
        if (doc.profile_photo_id) {
          const url = `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${doc.profile_photo_id}/view?project=${this.PROJECT_ID}`;
          this.profilePhotoUrl = url;
          this.appwrite.updateProfilePhoto(url);
        } else {
          const defaultUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2563eb&color=fff&size=128`;
          this.profilePhotoUrl = defaultUrl;
          this.appwrite.updateProfilePhoto(defaultUrl);
        }

        // ── Full name ──
        const firstName  = (doc.first_name  ?? '').trim();
        const middleName = (doc.middle_name ?? '').trim();
        const lastName   = (doc.last_name   ?? '').trim();
        const fullName   = [firstName, middleName, lastName].filter(Boolean).join(' ') || user.name || 'Intern';

        this.certSentByAdmin = doc.cert_sent === true;
        if (doc.cert_verification_id) {
  this.certVerificationId = doc.cert_verification_id;
  this.certQrDataUrl = await this.generateQrCode(doc.cert_verification_id);
}
        // ── Last attendance date ──
        const lastAttDate = await this.fetchLastAttendanceDate(doc.student_id ?? '');

        // ── Load supervisor info + e-sig ──
        await this.loadSupervisorData(doc.supervisor_id ?? '');

        this.certData = {
          studentName:    fullName,
          school:         doc.school_name      ?? '',
          course:         doc.course           ?? '',
          hoursCompleted: Number(doc.completed_hours ?? 0),
          requiredHours:  Number(doc.required_hours  ?? this.certTemplate.requiredHours),
          startDate:      this.formatDate(doc.start_date ?? ''),
          endDate:        lastAttDate
                            || this.formatDate(doc.end_date       ?? '')
                            || this.formatDate(doc.cert_sent_date ?? ''),
          dateIssued:     this.formatDate(doc.cert_sent_date ?? ''),
        };
      }
    } catch (err) {
      console.error('loadInternData error:', err);
      this.profilePhotoUrl = 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff&size=128';
    }
  }

  // ── Fetch supervisor document and load their e-sig as base64 ──
  private async loadSupervisorData(supervisorId: string): Promise<void> {
    if (!supervisorId) return;

    try {
      const supDoc = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL,
        supervisorId
      ) as any;

      const supFirstName = (supDoc.first_name ?? '').trim();
      const supLastName  = (supDoc.last_name  ?? '').trim();
      this.supervisorName = [supFirstName, supLastName].filter(Boolean).join(' ')
                            || this.certTemplate.supervisorName;
      this.supervisorPos  = supDoc.grade_level ?? this.certTemplate.supervisorPos;

      // ── Download e-sig as base64 ──
      if (supDoc.esig_file_id) {
        this.supervisorRightSigBase64 = await this.appwriteFileToBase64(supDoc.esig_file_id);
      } else {
        this.supervisorRightSigBase64 = '';
      }

    } catch (err) {
      console.warn('Could not load supervisor data:', err);
      // Fallback to template defaults
      this.supervisorName           = this.certTemplate.supervisorName;
      this.supervisorPos            = this.certTemplate.supervisorPos;
      this.supervisorRightSigBase64 = this.certTemplate.rightSigUrl;
    }
  }

  private async fetchLastAttendanceDate(studentId: string): Promise<string> {
    if (!studentId) return '';
    try {
      const attRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL,
        [
          Query.equal('student_id', studentId),
          Query.equal('status', 'Present'),
          Query.orderDesc('date'),
          Query.limit(1),
        ]
      );
      if (attRes.documents.length > 0) {
        const lastDoc = attRes.documents[0] as any;
        return this.formatDate(lastDoc.date ?? '');
      }
    } catch (err) {
      console.warn('Could not fetch last attendance:', err);
    }
    return '';
  }

  getBodyText(): string {
    const raw = this.certTemplate.bodyText || '';
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/\{name\}/g,   `<strong>${this.escapeHtml(this.certData.studentName)}</strong>`)
      .replace(/\{hours\}/g,  `<strong>${this.certData.hoursCompleted}</strong>`)
      .replace(/\{course\}/g, `<strong>${this.escapeHtml(this.certData.course)}</strong>`)
      .replace(/\{school\}/g, `<strong>${this.escapeHtml(this.certData.school)}</strong>`)
      .replace(/\{host\}/g,   `<strong>${this.escapeHtml(this.certTemplate.hostSchool)}</strong>`);
  }

  getGivenText(): string {
    const date = this.certData.endDate || this.certData.dateIssued
      || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const location = this.certTemplate.schoolName;
    return (this.certTemplate.givenText || '')
      .replace(/\{date\}/g,     date)
      .replace(/\{location\}/g, location);
  }

  private escapeHtml(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private formatDate(raw: string): string {
    if (!raw) return '';
    try { return new Date(raw).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return raw; }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

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
    this.menuOpen = false;
    if (!this.certSentByAdmin) {
      if (this.certData.hoursCompleted < this.certData.requiredHours) {
        Swal.fire({
          icon: 'info', title: 'Not Yet Available',
          text: `You need to complete ${this.certData.requiredHours} hours first. You currently have ${this.certData.hoursCompleted} hrs.`,
          confirmButtonColor: '#2563eb'
        });
      } else {
        Swal.fire({
          icon: 'info', title: 'Certificate Pending',
          text: 'You have completed your required hours! Your certificate will be available once the admin issues it.',
          confirmButtonColor: '#2563eb'
        });
      }
      return;
    }
    this.showCertModal = true;
  }

  // ── Download certificate as PDF ──
  async downloadCertificate(): Promise<void> {
    const certEl = document.getElementById('certificate-preview');
    if (!certEl || this.isDownloading) return;

    this.isDownloading = true;

    try {
      const canvas = await html2canvas(certEl, {
        scale:           3,
        useCORS:         false,
        allowTaint:      false,
        backgroundColor: '#ffffff',
        windowWidth:     certEl.scrollWidth,
        windowHeight:    certEl.scrollHeight,
        x: 0, y: 0, scrollX: 0, scrollY: 0,
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfW    = pdf.internal.pageSize.getWidth();
      const pdfH    = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
      pdf.save(`Certificate_${this.certData.studentName.replace(/\s+/g, '_')}.pdf`);

    } catch (err) {
      console.error('PDF generation failed:', err);
      Swal.fire({
        icon: 'error', title: 'Download Failed',
        text: 'Could not generate the PDF. Please try again.',
        confirmButtonColor: '#2563eb'
      });
    } finally {
      this.isDownloading = false;
    }
  }

  async updatePassword() {
    this.pwError = ''; this.pwSuccess = '';
    this.pwFieldErrors = { current: '', newPw: '', confirm: '' };
    let hasError = false;
    if (!this.currentPassword) { this.pwFieldErrors.current = 'Current password is required.'; hasError = true; }
    if (!this.newPassword) { this.pwFieldErrors.newPw = 'New password is required.'; hasError = true; }
    else {
      const e = this.validateStrongPassword(this.newPassword);
      if (e) { this.pwFieldErrors.newPw = e; hasError = true; }
      else if (this.newPassword === this.currentPassword) { this.pwFieldErrors.newPw = 'New password must be different from current.'; hasError = true; }
    }
    if (!this.confirmPassword) { this.pwFieldErrors.confirm = 'Please confirm your new password.'; hasError = true; }
    else if (this.newPassword && this.confirmPassword !== this.newPassword) { this.pwFieldErrors.confirm = 'Passwords do not match.'; hasError = true; }
    if (hasError) return;
    this.passwordLoading = true;
    try {
      await this.appwrite.account.updatePassword(this.newPassword, this.currentPassword);
      this.pwSuccess = 'Password updated successfully!';
      this.currentPassword = ''; this.newPassword = ''; this.confirmPassword = '';
      setTimeout(() => {
        this.closeModal();
        Swal.fire({
          icon: 'success', title: 'Password Updated!',
          text: 'Your password has been changed successfully.',
          toast: true, position: 'top-end',
          showConfirmButton: false, timer: 3000, timerProgressBar: true
        });
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
    if (hour < 12) return 'Good Morning, Intern!';
    else if (hour < 18) return 'Good Afternoon, Intern!';
    else return 'Good Evening, Intern!';
  }

  validateStrongPassword(password: string): string {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]=+;/']/.test(password)) return 'Password must contain at least one special character.';
    return '';
  }
  private async generateQrCode(verificationId: string): Promise<string> {
  const url = `${window.location.origin}/verify/${verificationId}`;
  try {
    return await QRCode.toDataURL(url, {
      width: 160,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch { return ''; }
}
}