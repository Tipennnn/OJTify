import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppwriteService } from '../services/appwrite.service';
import { Query } from 'appwrite';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ── Mirrors the CertTemplate interface in the admin component ────────────────
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
  depedLogoUrl:      'assets/images/Deped_logo.png',
  schoolLogoUrl:     'assets/images/OCES_logo.png',
  watermarkUrl:      'assets/images/OCES_logo.png',
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

  // DateTime
  currentDayDate = '';
  currentTime    = '';
  private clockInterval: any;

  // ── Whether the admin has actually sent the cert for this intern ──────────
  certSentByAdmin = false;

  // ── Template loaded from localStorage (same key the admin saves to) ───────
  certTemplate: CertTemplate = { ...DEFAULT_TEMPLATE };

  certData = {
    studentName:    '',
    school:         '',
    course:         '',
    hoursCompleted: 0,
    requiredHours:  500,
    startDate:      '',
    endDate:        '',   // ← last attendance date
    dateIssued:     '',
  };

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

  await this.loadCertTemplate();   // ← now awaited
  await this.loadInternData();

  this.updateClock();
  this.clockInterval = setInterval(() => this.updateClock(), 1000);
}

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  // ── Load the same localStorage key the admin writes to ───────────────────
  private async loadCertTemplate(): Promise<void> {
  try {
    const user = await this.appwrite.account.get();

    let adminDoc: any = null;
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ADMINS_COL,
        [Query.equal('auth_user_id', user.$id)]
      );
      if (res.documents.length > 0) adminDoc = res.documents[0];
    } catch { /* ignore */ }

    // Can't filter by admin's auth_user_id from intern side — just get first admin doc
    if (!adminDoc) {
      try {
        const res = await this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.ADMINS_COL,
          []
        );
        if (res.documents.length > 0) adminDoc = res.documents[0];
      } catch { /* ignore */ }
    }

    if (adminDoc?.cert_template_json) {
      const parsed = JSON.parse(adminDoc.cert_template_json);
      if (adminDoc.cert_deped_logo_url)   parsed.depedLogoUrl  = adminDoc.cert_deped_logo_url;
      if (adminDoc.cert_school_logo_url)  parsed.schoolLogoUrl = adminDoc.cert_school_logo_url;
      if (adminDoc.cert_watermark_url)    parsed.watermarkUrl  = adminDoc.cert_watermark_url;
      if (adminDoc.cert_left_sig_url)     parsed.leftSigUrl    = adminDoc.cert_left_sig_url;
      if (adminDoc.cert_right_sig_url)    parsed.rightSigUrl   = adminDoc.cert_right_sig_url;
      this.certTemplate = { ...DEFAULT_TEMPLATE, ...parsed };
      localStorage.setItem('admin_cert_template', JSON.stringify(this.certTemplate));
      return;
    }
  } catch (err) {
    console.warn('Could not load cert template from DB:', err);
  }
  const saved = localStorage.getItem('admin_cert_template');
  if (saved) {
    try { this.certTemplate = { ...DEFAULT_TEMPLATE, ...JSON.parse(saved) }; }
    catch { this.certTemplate = { ...DEFAULT_TEMPLATE }; }
  }
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

  /**
   * 1. Load student document → cert_sent, hours, name, etc.
   * 2. Fetch last attendance record → use its date as the cert end date.
   */
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
        // ── Profile photo ─────────────────────────────────────────────────
        if (doc.profile_photo_id) {
          const url = `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${doc.profile_photo_id}/view?project=${this.PROJECT_ID}`;
          this.profilePhotoUrl = url;
          this.appwrite.updateProfilePhoto(url);
        } else {
          const defaultUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2563eb&color=fff&size=128`;
          this.profilePhotoUrl = defaultUrl;
          this.appwrite.updateProfilePhoto(defaultUrl);
        }

        // ── Full name ─────────────────────────────────────────────────────
        const firstName  = (doc.first_name  ?? '').trim();
        const middleName = (doc.middle_name ?? '').trim();
        const lastName   = (doc.last_name   ?? '').trim();
        const fullName   = [firstName, middleName, lastName].filter(Boolean).join(' ') || user.name || 'Intern';

        // ── cert_sent from DB ─────────────────────────────────────────────
        this.certSentByAdmin = doc.cert_sent === true;

        // ── Last attendance date (used as end date on the cert) ───────────
        // attendance.student_id stores the student's string ID (e.g. "202211168")
        const lastAttDate = await this.fetchLastAttendanceDate(doc.student_id ?? '');

        this.certData = {
          studentName:    fullName,
          school:         doc.school_name      ?? '',
          course:         doc.course           ?? '',
          hoursCompleted: Number(doc.completed_hours ?? 0),
          requiredHours:  Number(doc.required_hours  ?? this.certTemplate.requiredHours),
          startDate:      this.formatDate(doc.start_date ?? ''),
          // Priority: last attendance date → doc.end_date → cert_sent_date
          endDate:        lastAttDate
                            || this.formatDate(doc.end_date        ?? '')
                            || this.formatDate(doc.cert_sent_date  ?? ''),
          dateIssued:     this.formatDate(doc.cert_sent_date ?? ''),
        };
      }
    } catch (err) {
      console.error('loadInternData error:', err);
      this.profilePhotoUrl = 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff&size=128';
    }
  }

  /**
   * Returns the formatted date string of the intern's most recent attendance,
   * or '' if none is found.
   */
  private async fetchLastAttendanceDate(studentId: string): Promise<string> {
    if (!studentId) return '';
    try {
      const attRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        'attendance',
        [
          Query.equal('student_id', studentId),
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

  // ── Body text with token replacement (mirrors admin) ──────────────────────
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

  // ── Given / closing line with token replacement ───────────────────────────
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
        Swal.fire({ icon: 'info', title: 'Not Yet Available', text: `You need to complete ${this.certData.requiredHours} hours first. You currently have ${this.certData.hoursCompleted} hrs.`, confirmButtonColor: '#2563eb' });
      } else {
        Swal.fire({ icon: 'info', title: 'Certificate Pending', text: 'You have completed your required hours! Your certificate will be available once the admin issues it.', confirmButtonColor: '#2563eb' });
      }
      return;
    }
    // Reload template in case admin updated it since page load
    this.loadCertTemplate();
    this.showCertModal = true;
  }

 async downloadCertificate() {
  const certEl = document.getElementById('certificate-preview');
  if (!certEl) return;

  try {
    const canvas = await html2canvas(certEl, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);

    // A4 landscape in mm
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
    pdf.save(`Certificate_${this.certData.studentName.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error('PDF generation failed:', err);
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
        Swal.fire({ icon: 'success', title: 'Password Updated!', text: 'Your password has been changed successfully.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
      }, 1200);
    } catch (error: any) {
      const msg: string = error.message ?? '';
      if (msg.toLowerCase().includes('invalid credentials') || msg.toLowerCase().includes('current') || error.code === 401) {
        this.pwFieldErrors.current = 'Current password is incorrect.';
      } else { this.pwError = 'Failed to update password. Please try again.'; }
    } finally { this.passwordLoading = false; }
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
}