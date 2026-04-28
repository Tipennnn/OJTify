import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
import { QRCodeModule } from 'angularx-qrcode';
import { Query } from 'appwrite';

interface AttendanceRecord {
  $id?: string;
  date: string;
  day: string;
  timeIn: string;
  timeOut: string;
  status: string;
  scannedBy?: string;
}

@Component({
  selector: 'app-intern-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InternSidenavComponent,
    InternTopnavComponent,
    QRCodeModule
  ],
  templateUrl: './intern-attendance.component.html',
  styleUrls: ['./intern-attendance.component.css']
})
export class InternAttendanceComponent implements OnInit, OnDestroy {

  showAttendanceModal = false;
  showReportsModal    = false;
  showQRModal         = false;

  certVerificationId = '';

  selectedDate  = '';
  timeIn        = '—';
  timeOut       = '—';
  status        = 'No Attendance Record';
  scannedBy     = '—';
  calendarReady = false;

  firstDayOfMonth = 0;
  today = new Date();
  month = this.today.getMonth();
  year  = this.today.getFullYear();
  days  : number[] = [];

  attendanceStatus : { [key: number]: string } = {};
  attendanceRecords: { [key: number]: any }    = {};
  internStartDate  : Date | null = null;

  reportFilterMonth  = '';
  reportFilterYear   = '';
  reportFilterStatus = '';
  filteredRecordsList: AttendanceRecord[] = [];
  allRecords         : AttendanceRecord[] = [];

  reportCurrentPage = 1;
  reportPageSize    = 10;
  readonly Math     = Math;

  get reportTotalPages(): number {
    return Math.ceil(this.filteredRecordsList.length / this.reportPageSize) || 1;
  }

  get reportPageNumbers(): number[] {
    return Array.from({ length: this.reportTotalPages }, (_, i) => i + 1);
  }

  get pagedRecordsList(): AttendanceRecord[] {
    const start = (this.reportCurrentPage - 1) * this.reportPageSize;
    return this.filteredRecordsList.slice(start, start + this.reportPageSize);
  }

  reportGoToPage(page: number) {
    if (page < 1 || page > this.reportTotalPages) return;
    this.reportCurrentPage = page;
  }

  reportPrevPage() { this.reportGoToPage(this.reportCurrentPage - 1); }
  reportNextPage() { this.reportGoToPage(this.reportCurrentPage + 1); }

  currentUserId = '';
  qrData        = '';
  qrExpiresIn   = 10;
  private qrTimer: any;
  realStudentId = '';
  internName    = '';

  requiredHours  = 500;
  completedHours = 0;
  todayStatus    = 'Absent';

  months  = ['January','February','March','April','May','June',
             'July','August','September','October','November','December'];
  years   : number[] = [];
  statuses = ['Present', 'Absent'];

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.getCurrentUser();
    await this.loadInternStartDate();
    this.generateCalendar();
    await Promise.all([
      this.loadAttendance(),
      this.loadStudentHours(),
      this.loadTodayStatus(),
    ]);
    this.calendarReady = true;
    this.generateYears();
  }

  ngOnDestroy() { clearInterval(this.qrTimer); }

  async getCurrentUser() {
    try {
      const user         = await this.appwrite.account.get();
      this.currentUserId = user.$id;
      this.internName    = user.name || '';
      this.generateFreshQR();
      this.startQRCountdown();
    } catch (error: any) {
      console.error('Failed to get user:', error.message);
    }
  }

  generateFreshQR() {
    const ts         = Date.now();
    this.qrData      = `OJTIFY_ATTENDANCE:${this.currentUserId}:${ts}`;
    this.qrExpiresIn = 10;
  }

  startQRCountdown() {
    clearInterval(this.qrTimer);
    this.qrTimer = setInterval(() => { this.qrExpiresIn--; }, 1000);
  }

  refreshQRManually() {
    clearInterval(this.qrTimer);
    this.generateFreshQR();
    this.startQRCountdown();
  }

  async loadStudentHours() {
    try {
      const doc = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL, this.currentUserId
      );
      this.requiredHours      = (doc as any).required_hours  || 500;
      this.completedHours     = (doc as any).completed_hours || 0;
      this.realStudentId      = (doc as any).student_id      || this.currentUserId;
      this.certVerificationId = (doc as any).cert_verification_id || '';
      if (!this.internName) this.internName = (doc as any).name || '';
    } catch (error: any) {
      console.error('Failed to load hours:', error.message);
    }
  }

 async loadTodayStatus() {
  try {
    const now   = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const res   = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL, [Query.limit(500)]
    );
    const todayRecord = (res.documents as any[])
      .find(d => d.student_id === this.currentUserId && d.date === today);

    this.todayStatus = todayRecord 
      ? todayRecord.status 
      : (now.getHours() >= 17 ? 'Absent' : 'No Attendance Record');

  } catch (error: any) {
    console.error('Failed to load today status:', error.message);
  }
}

  async loadInternStartDate() {
    try {
      const doc = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL, this.currentUserId
      );
      const createdAt = (doc as any).$createdAt;
      if (createdAt) {
        const d = new Date(createdAt);
        d.setHours(0,0,0,0);
        this.internStartDate = d;
      }
    } catch (error: any) {
      console.error('Failed to load intern start date:', error.message);
    }
  }

  get remainingHours(): number {
    return Math.max(this.requiredHours - this.completedHours, 0);
  }

  get hoursProgress(): number {
    if (this.requiredHours === 0) return 0;
    return Math.min(parseFloat(((this.completedHours / this.requiredHours) * 100).toFixed(1)), 100);
  }

 async loadAttendance() {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL, [Query.limit(500)]
    );
    const docs      = res.documents as any[];
    const myRecords = docs.filter(d => d.student_id === this.currentUserId);

    this.attendanceStatus  = {};
    this.attendanceRecords = {};
    this.allRecords        = [];

    const recordsByDate: { [dateStr: string]: any } = {};

    myRecords.forEach(record => {
      const parts       = record.date.split('-');
      const recordYear  = parseInt(parts[0], 10);
      const recordMonth = parseInt(parts[1], 10) - 1;
      const recordDay   = parseInt(parts[2], 10);
      recordsByDate[record.date] = record;
      if (recordMonth === this.month && recordYear === this.year) {
        this.attendanceStatus[recordDay]  = record.status;
        this.attendanceRecords[recordDay] = record;
      }
      this.allRecords.push({
        $id:       record.$id,
        date:      record.date,
        day:       new Date(recordYear, recordMonth, recordDay)
                     .toLocaleString('default', { weekday: 'short' }),
        timeIn:    record.time_in         || '—',
        timeOut:   record.time_out        || '—',
        status:    record.status === 'Present' ? 'Present' : 'Absent',
        scannedBy: record.scanned_by_name || '—'
      });
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const currentTime = new Date();
    const isPast5PM = currentTime.getHours() >= 17;

    // Include today if it's past 5PM
    const loopEnd = isPast5PM
      ? new Date(now.getTime() + 86400000)
      : now;

    const cursor = this.internStartDate
      ? new Date(this.internStartDate)
      : new Date(now.getFullYear(), 0, 1);

    while (cursor < loopEnd) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        const yyyy    = cursor.getFullYear();
        const mm      = String(cursor.getMonth()+1).padStart(2,'0');
        const dd      = String(cursor.getDate()).padStart(2,'0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        if (!recordsByDate[dateStr]) {
          this.allRecords.push({
            date:      dateStr,
            day:       cursor.toLocaleString('default', { weekday: 'short' }),
            timeIn:    '—', timeOut: '—', status: 'Absent', scannedBy: '—'
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    this.allRecords.sort((a, b) => a.date.localeCompare(b.date));
    this.applyReportFilters();
  } catch (error: any) {
    console.error('Failed to load attendance:', error.message);
  }
}

  get monthName() {
    return new Date(this.year, this.month).toLocaleString('default', { month: 'long' });
  }

  getEmptyCells(): number[] {
    return Array.from({ length: this.firstDayOfMonth }, (_, i) => i);
  }

  generateCalendar() {
    const totalDays = new Date(this.year, this.month + 1, 0).getDate();
    const firstDay  = new Date(this.year, this.month, 1).getDay();
    this.days = Array.from({ length: totalDays }, (_, i) => i + 1);
    this.firstDayOfMonth = firstDay;
  }

  isWeekend(day: number): boolean {
    const date = new Date(this.year, this.month, day);
    return date.getDay() === 0 || date.getDay() === 6;
  }

  async prevMonth() {
    this.month--;
    if (this.month < 0) { this.month = 11; this.year--; }
    this.generateCalendar();
    await this.loadAttendance();
  }

  async nextMonth() {
    this.month++;
    if (this.month > 11) { this.month = 0; this.year++; }
    this.generateCalendar();
    await this.loadAttendance();
  }

isPastWeekdayWithNoRecord(day: number): boolean {
  if (this.isWeekend(day)) return false;
  const date = new Date(this.year, this.month, day);
  const now  = new Date();
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const isToday = date.getTime() === todayMidnight.getTime();

  // ✅ For today specifically: only mark absent if it's past 5PM
  if (isToday) {
    const isPast5PM = now.getHours() >= 17;
    if (!isPast5PM) return false;
    return !this.attendanceStatus[day]; // absent if no record
  }

  // For past days (before today)
  if (date >= todayMidnight) return false;
  if (this.internStartDate && date < this.internStartDate) return false;
  if (this.attendanceStatus[day]) return false;
  return true;
}

  openAttendance(day: number) {
    const date = new Date(this.year, this.month, day);
    this.selectedDate = date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const record = this.attendanceRecords[day];
    if (record) {
      this.status    = record.status;
      this.timeIn    = record.time_in         || '—';
      this.timeOut   = record.time_out        || '—';
      this.scannedBy = record.scanned_by_name || '—';
    } else if (this.isPastWeekdayWithNoRecord(day)) {
      this.status = 'Absent'; this.timeIn = '—'; this.timeOut = '—'; this.scannedBy = '—';
    } else {
      this.status = 'No Attendance Record'; this.timeIn = '—'; this.timeOut = '—'; this.scannedBy = '—';
    }
    this.showAttendanceModal = true;
  }

  closeAttendance()   { this.showAttendanceModal = false; }
  openReportsModal()  { this.showReportsModal = true; this.applyReportFilters(); }
  closeReportsModal() { this.showReportsModal = false; }
  openQRModal()       { this.showQRModal = true; }
  closeQRModal()      { this.showQRModal = false; }

  applyReportFilters() {
    this.filteredRecordsList = this.allRecords.filter(r => {
      const parts       = r.date.split('-');
      const recordYear  = parseInt(parts[0], 10);
      const recordMonth = parseInt(parts[1], 10) - 1;
      const d           = new Date(recordYear, recordMonth, parseInt(parts[2], 10));
      const monthMatch  = this.reportFilterMonth
        ? d.toLocaleString('default', { month: 'long' }) === this.reportFilterMonth : true;
      const yearMatch   = this.reportFilterYear
        ? d.getFullYear().toString() === this.reportFilterYear.toString() : true;
      const statusMatch = this.reportFilterStatus
        ? r.status === this.reportFilterStatus : true;
      return monthMatch && yearMatch && statusMatch;
    });
    this.reportCurrentPage = 1;
  }

  generateYears() {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= currentYear - 5; i--) { this.years.push(i); }
  }

  private formatDateLong(dateStr: string): string {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0],10), parseInt(parts[1],10)-1, parseInt(parts[2],10));
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ── Load a local Angular asset as base64 ──────────────────────────────
  private async loadImageAsBase64(assetPath: string): Promise<string | null> {
    try {
      const res = await fetch(assetPath);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror   = reject;
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  }

  // ── Build QR code as base64 PNG ───────────────────────────────────────
  private buildQrBase64(text: string, size: number): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const QRCode = await import('qrcode');
        const lib    = (QRCode as any).default ?? QRCode;
        const dataUrl: string = await lib.toDataURL(text, {
          width: size, margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });
        resolve(dataUrl);
      } catch (err) { reject(err); }
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  DOWNLOAD DTR PDF  —  Simple, Clean, Official Document
  // ══════════════════════════════════════════════════════════════════════
  async downloadDTRPdf() {
    const { jsPDF } = await import('jspdf');
    const { ID }    = await import('appwrite');

    this.applyReportFilters();

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const PW  = doc.internal.pageSize.getWidth();   // 210mm
    const PH  = doc.internal.pageSize.getHeight();  // 297mm
    const ML  = 20;    // left margin
    const MR  = 20;    // right margin
    const CW  = PW - ML - MR;   // 170mm usable width

    // ── Period label ────────────────────────────────────────────────────
    let periodLabel = '';
    if (this.reportFilterMonth && this.reportFilterYear) {
      periodLabel = `${this.reportFilterMonth} ${this.reportFilterYear}`;
    } else if (this.reportFilterMonth) {
      periodLabel = this.reportFilterMonth;
    } else if (this.reportFilterYear) {
      periodLabel = this.reportFilterYear.toString();
    } else if (this.filteredRecordsList.length > 0) {
      const dates = this.filteredRecordsList
        .map(r => new Date(r.date)).filter(d => !isNaN(d.getTime()));
      if (dates.length) {
        const minD = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxD = new Date(Math.max(...dates.map(d => d.getTime())));
        const minM = minD.toLocaleString('default', { month: 'long' });
        const maxM = maxD.toLocaleString('default', { month: 'long' });
        const minY = minD.getFullYear(), maxY = maxD.getFullYear();
        if (minM === maxM && minY === maxY)  periodLabel = `${minM} ${minY}`;
        else if (minY === maxY)              periodLabel = `${minM} – ${maxM} ${minY}`;
        else                                 periodLabel = `${minM} ${minY} – ${maxM} ${maxY}`;
      }
    }
    if (!periodLabel) periodLabel = 'All Records';

    // ── Ref & verify URL ────────────────────────────────────────────────
    const ref          = this.generateRefCode();
    const dtrVerifyUrl = `${window.location.origin}/verify/dtr/${encodeURIComponent(ref)}`;

    // ── Save record to Appwrite ─────────────────────────────────────────
    try {
      await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID, 'dtr_records', ID.unique(),
        {
          ref,
          student_id:     this.realStudentId || this.currentUserId,
          student_doc_id: this.currentUserId,
          intern_name:    this.internName || '',
          period_label:   periodLabel,
          generated_at:   new Date().toISOString(),
          total_days:     this.filteredRecordsList.length,
          present_days:   this.filteredRecordsList.filter(r => r.status === 'Present').length,
          absent_days:    this.filteredRecordsList.filter(r => r.status === 'Absent').length,
        }
      );
    } catch (err: any) {
      console.error('DTR save failed (PDF still downloads):', err.message);
    }

    // ── Load assets in parallel (DUAL OCES, NO DEPED) ────────────────────
    const [ocesLogo, qrBase64] = await Promise.all([
      this.loadImageAsBase64('assets/images/OCES_logo.png'),
      this.buildQrBase64(dtrVerifyUrl, 200).catch(() => null as any),
    ]);

    // ── Load supervisor e-signature ─────────────────────────────────────
    let supervisorName = '';
    let esigBase64: string | null = null;
    try {
      const svRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, this.appwrite.SUPERVISORS_COL
      );
      const svDoc = (svRes.documents as any[])[0];
      if (svDoc) {
        supervisorName = `${svDoc.first_name || ''} ${svDoc.last_name || ''}`.trim();
        if (svDoc.esig_file_id) {
          try {
            const BUCKET_ID  = '69baaf64002ceb2490df';
            const PROJECT_ID = '69ba8d9c0027d10c447f';
            const ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';
            const jwt = await this.appwrite.account.createJWT();
            const res = await fetch(
              `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${svDoc.esig_file_id}/view?project=${PROJECT_ID}`,
              { headers: { 'X-Appwrite-JWT': jwt.jwt, 'X-Appwrite-Project': PROJECT_ID } }
            );
            if (res.ok) {
              const blob = await res.blob();
              esigBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror   = reject;
                reader.readAsDataURL(blob);
              });
            }
          } catch {}
        }
      }
    } catch {}

    // ════════════════════════════════════════════════════════════════════
    //  COLORS
    // ════════════════════════════════════════════════════════════════════
    type RGB = [number, number, number];
    const BLUE     : RGB = [28,  78,  145];  // DepEd blue
    const LITEBLUE : RGB = [235, 242, 255];  // light blue fills
    const DARK     : RGB = [25,  25,  25 ];  // body text
    const GRAY     : RGB = [100, 100, 100];  // secondary text
    const LGRAY    : RGB = [160, 160, 160];  // muted text
    const BORDER   : RGB = [190, 200, 215];  // borders
    const STRIPE   : RGB = [248, 249, 252];  // alternate row
    const WHITE    : RGB = [255, 255, 255];
    const GREEN    : RGB = [21,  128, 61 ];
    const RED      : RGB = [185, 28,  28 ];

    // Helpers
    const fc = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
    const tc = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
    const dc = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
    const lw = (w: number) => doc.setLineWidth(w);

    // ════════════════════════════════════════════════════════════════════
    //  FOOTER renderer (called on every page at the end)
    // ════════════════════════════════════════════════════════════════════
    const FY = PH - 18;   // footer starts here

    const drawFooter = (pg: number, total: number) => {
      // Thin top border
      dc(BORDER); lw(0.3);
      doc.line(ML, FY, ML + CW, FY);

      // QR code (small, bottom-left)
      const qSz = 12;
      if (qrBase64) {
        doc.addImage(qrBase64, 'PNG', ML, FY + 3, qSz, qSz);
      }

      const tx = ML + (qrBase64 ? qSz + 4 : 0);

      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); tc(GRAY);
      doc.text('Reference No.: ', tx, FY + 6);
      doc.setFont('helvetica', 'bold'); tc(DARK);
      doc.text(ref, tx + doc.getTextWidth('Reference No.: '), FY + 6);

      doc.setFont('helvetica', 'normal'); tc(GRAY);
      doc.text('Verify: ', tx, FY + 11);
      tc(BLUE);
      const urlShow = dtrVerifyUrl.length > 75 ? dtrVerifyUrl.slice(0,72) + '...' : dtrVerifyUrl;
      doc.text(urlShow, tx + doc.getTextWidth('Verify: '), FY + 11);

      doc.setFontSize(6); tc(LGRAY);
      doc.text('Generated by OJTify Attendance Management System', tx, FY + 16);

      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); tc(GRAY);
      doc.text(`Page ${pg} of ${total}`, ML + CW, FY + 10, { align: 'right' });
    };

    // ════════════════════════════════════════════════════════════════════
    //  PAGE CONTENT START
    // ════════════════════════════════════════════════════════════════════
    let y = ML;
    const SAFE = FY - 4;   // don't draw table rows below this

    // ────────────────────────────────────────────────────────────────────
    //  HEADER BLOCK
    //  Layout: [OCES logo] | [center text] | [OCES logo]
    // ────────────────────────────────────────────────────────────────────
    const HDR_H  = 30;
    const LOGO_SZ = 24;
    const LOGO_Y  = y + (HDR_H - LOGO_SZ) / 2;

    // Outer border of header
    dc(BORDER); lw(0.4);
    doc.rect(ML, y, CW, HDR_H, 'S');

    // OCES logo — left
    if (ocesLogo) {
      doc.addImage(ocesLogo, 'PNG', ML + 4, LOGO_Y, LOGO_SZ, LOGO_SZ);
    }

    // OCES logo — right (duplicate)
    if (ocesLogo) {
      doc.addImage(ocesLogo, 'PNG', ML + CW - LOGO_SZ - 4, LOGO_Y, LOGO_SZ, LOGO_SZ);
    }

    // Center text
    const cx = PW / 2;
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); tc(GRAY);
    doc.text('Republic of the Philippines', cx, y + 7, { align: 'center' });
    doc.text('Department of Education', cx, y + 12, { align: 'center' });
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); tc(BLUE);
    doc.text('OJT Coordination & Evaluation Section (OCES)', cx, y + 18, { align: 'center' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); tc(GRAY);
    doc.text('On-the-Job Training Program', cx, y + 23, { align: 'center' });

    y += HDR_H;

    // ────────────────────────────────────────────────────────────────────
    //  DOCUMENT TITLE BAR
    // ────────────────────────────────────────────────────────────────────
    fc(BLUE);
    doc.rect(ML, y, CW, 10, 'F');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); tc(WHITE);
    doc.text('DAILY TIME RECORD (DTR)', cx, y + 7, { align: 'center' });
    y += 10;

    // ────────────────────────────────────────────────────────────────────
    //  PERIOD + REF SUB-BAR
    // ────────────────────────────────────────────────────────────────────
    fc(LITEBLUE); dc(BORDER); lw(0.3);
    doc.rect(ML, y, CW, 7, 'FD');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); tc(BLUE);
    doc.text(`Period Covered: ${periodLabel}`, ML + 4, y + 5);
    doc.text(`Doc. Ref.: ${ref}`, ML + CW - 4, y + 5, { align: 'right' });
    y += 7 + 4;

    // ────────────────────────────────────────────────────────────────────
    //  INTERN INFORMATION BLOCK
    // ────────────────────────────────────────────────────────────────────
    const INFO_H = 30;
    dc(BORDER); lw(0.3);
    doc.rect(ML, y, CW, INFO_H, 'S');

    // Section header strip
    fc(LITEBLUE);
    doc.rect(ML, y, CW, 7, 'F');
    dc(BORDER); lw(0.2);
    doc.line(ML, y + 7, ML + CW, y + 7);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); tc(BLUE);
    doc.text('INTERN INFORMATION', ML + 4, y + 5.2);

    // 3 columns: name | student ID | hours
    const C1 = ML + 4;
    const C2 = ML + CW / 3 + 4;
    const C3 = ML + (CW / 3) * 2 + 4;
    const COL_W = CW / 3 - 8;

    // column dividers
    dc(BORDER); lw(0.2);
    doc.line(ML + CW/3, y + 7, ML + CW/3, y + INFO_H);
    doc.line(ML + (CW/3)*2, y + 7, ML + (CW/3)*2, y + INFO_H);

    // Helper: draw label + value pair
    const field = (label: string, value: string, fx: number, fy: number, valColor: RGB = DARK) => {
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); tc(GRAY);
      doc.text(label, fx, fy);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.setTextColor(valColor[0], valColor[1], valColor[2]);
      // Clamp to column width
      const maxW = COL_W;
      let txt = value;
      while (doc.getTextWidth(txt) > maxW && txt.length > 1) {
        txt = txt.slice(0, -1);
      }
      if (txt !== value) txt = txt.slice(0, -1) + '…';
      doc.text(txt, fx, fy + 5.5);
    };

    // Row 1
    field('Intern Name',     this.internName    || '—', C1, y + 12);
    field('Student ID',      this.realStudentId || '—', C2, y + 12);
    field('Required Hours',  `${this.requiredHours} hrs`, C3, y + 12, BLUE);

    // Row 2
    field('Completed Hours', `${this.completedHours} hrs`, C1, y + 22, GREEN);
    field('Remaining Hours', `${this.remainingHours} hrs`, C2, y + 22, RED);
    field('Progress',        `${this.hoursProgress}%`,     C3, y + 22, BLUE);

    y += INFO_H + 3;

    // Date generated line
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); tc(LGRAY);
    const genDate = new Date().toLocaleDateString('en-US',
      { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Date Generated: ${genDate}`, ML, y + 3);
    y += 7;

    // ════════════════════════════════════════════════════════════════════
    //  ATTENDANCE TABLE
    // ════════════════════════════════════════════════════════════════════
    const ROW_H  = 7;
    const HEAD_H = 8;

    // Column config: label, width (mm), text alignment
    type Align = 'left' | 'center' | 'right';
    const COLS: { label: string; w: number; align: Align }[] = [
      { label: 'Date',        w: 46, align: 'left'   },
      { label: 'Day',         w: 15, align: 'center' },
      { label: 'Time In',     w: 24, align: 'center' },
      { label: 'Time Out',    w: 24, align: 'center' },
      { label: 'Recorded By', w: 38, align: 'left'   },
      { label: 'Status',      w: 23, align: 'center' },
    ];
    // (Total = 170 = CW ✓)

    // Precompute column x positions
    const colX: number[] = [];
    let accX = ML;
    COLS.forEach(c => { colX.push(accX); accX += c.w; });

    // ── Draw table header ──────────────────────────────────────────────
    const drawHead = (hy: number) => {
      fc(BLUE);
      doc.rect(ML, hy, CW, HEAD_H, 'F');
      COLS.forEach((col, i) => {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); tc(WHITE);
        const tx2 = col.align === 'center'
          ? colX[i] + col.w / 2
          : col.align === 'right'
          ? colX[i] + col.w - 2
          : colX[i] + 2;
        doc.text(col.label, tx2, hy + 5.5, { align: col.align });
      });
      // Thin white column separator lines
      dc(WHITE); lw(0.15);
      for (let i = 1; i < COLS.length; i++) {
        doc.line(colX[i], hy + 1.5, colX[i], hy + HEAD_H - 1.5);
      }
    };

    // ── Draw a single data row ─────────────────────────────────────────
    const drawRow = (r: AttendanceRecord, rowIdx: number, ry: number) => {
      if (rowIdx % 2 === 0) { fc(STRIPE); } else { fc(WHITE); }
      doc.rect(ML, ry, CW, ROW_H, 'F');

      // Bottom border
      dc(BORDER); lw(0.2);
      doc.line(ML, ry + ROW_H, ML + CW, ry + ROW_H);

      // Column separators
      lw(0.15);
      for (let i = 1; i < COLS.length; i++) {
        doc.line(colX[i], ry + 0.5, colX[i], ry + ROW_H - 0.5);
      }

      const cells = [
        this.formatDateLong(r.date),
        r.day,
        r.timeIn,
        r.timeOut,
        r.scannedBy || '—',
        r.status,
      ];

      cells.forEach((cell, i) => {
        const col = COLS[i];
        doc.setFontSize(7.5);

        if (i === 5) {
          // Status — small colored badge
          const isPresent = cell === 'Present';
          const isAbsent  = cell === 'Absent';
          const bgC: RGB  = isPresent ? [220, 252, 231] : isAbsent ? [254, 226, 226] : [242, 244, 247];
          const fgC: RGB  = isPresent ? GREEN            : isAbsent ? RED             : GRAY;
          const bw = 19, bh = 4.5;
          const bx = colX[i] + (col.w - bw) / 2;
          const by = ry + (ROW_H - bh) / 2;
          fc(bgC);
          doc.roundedRect(bx, by, bw, bh, 2, 2, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(fgC[0], fgC[1], fgC[2]);
          doc.text(cell, bx + bw / 2, by + 3.3, { align: 'center' });
        } else {
          doc.setFont('helvetica', 'normal'); tc(DARK);
          const tx2 = col.align === 'center'
            ? colX[i] + col.w / 2
            : col.align === 'right'
            ? colX[i] + col.w - 2
            : colX[i] + 2;
          // Truncate to column width
          const maxCh = Math.floor(col.w / 1.75);
          const txt = cell.length > maxCh ? cell.slice(0, maxCh - 1) + '…' : cell;
          doc.text(txt, tx2, ry + 5, { align: col.align });
        }
      });
    };

    // ── Outer border & header ──────────────────────────────────────────
    dc(BORDER); lw(0.3);
    doc.rect(ML, y, CW, HEAD_H, 'S');   // header outline
    drawHead(y);
    y += HEAD_H;

    // ── Rows ───────────────────────────────────────────────────────────
    if (this.filteredRecordsList.length === 0) {
      fc(STRIPE);
      doc.rect(ML, y, CW, 12, 'F');
      dc(BORDER); lw(0.3);
      doc.line(ML, y, ML, y + 12);
      doc.line(ML + CW, y, ML + CW, y + 12);
      doc.line(ML, y + 12, ML + CW, y + 12);
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); tc(GRAY);
      doc.text('No records found for the selected filters.', cx, y + 8, { align: 'center' });
      y += 12;
    } else {
      // Left/right border lines run the full height of the table body
      const tableStartY = y;
      this.filteredRecordsList.forEach((r, idx) => {
        if (y + ROW_H > SAFE) {
          // Close current page's table border
          dc(BORDER); lw(0.3);
          doc.line(ML,      tableStartY, ML,      y);
          doc.line(ML + CW, tableStartY, ML + CW, y);
          doc.addPage();
          y = ML;
          drawHead(y);
          y += HEAD_H;
        }
        drawRow(r, idx, y);
        y += ROW_H;
      });
      // Close table border
      dc(BORDER); lw(0.3);
      doc.line(ML,      tableStartY, ML,      y);
      doc.line(ML + CW, tableStartY, ML + CW, y);
      doc.line(ML, y, ML + CW, y);   // bottom border
    }

    // ────────────────────────────────────────────────────────────────────
    //  SUMMARY ROW
    // ────────────────────────────────────────────────────────────────────
    if (y + 10 > SAFE) { doc.addPage(); y = ML; }
    y += 2;

    const presentCount = this.filteredRecordsList.filter(r => r.status === 'Present').length;
    const absentCount  = this.filteredRecordsList.filter(r => r.status === 'Absent').length;
    const totalCount   = this.filteredRecordsList.length;

    fc(LITEBLUE); dc(BORDER); lw(0.3);
    doc.rect(ML, y, CW, 8, 'FD');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); tc(BLUE);
    doc.text(
      `Total Days: ${totalCount}     Present: ${presentCount}     Absent: ${absentCount}     Progress: ${this.hoursProgress}%`,
      cx, y + 5.5, { align: 'center' }
    );
    y += 8 + 55;

    // ════════════════════════════════════════════════════════════════════
    //  SIGNATURE BLOCK — LOWER RIGHT of PAGE (BEFORE FOOTER LINE)
    //  👉 FIND THIS SECTION: Line 842-872 in downloadDTRPdf() method
    //  👉 EDIT HERE: E-SIGNATURE SIZE, SUPERVISOR NAME, TITLE, DATE
    // ════════════════════════════════════════════════════════════════════
    // Position signature on the far right side, ABOVE footer divider
    const sigX = ML + CW - 55;      // even further right
    const sigY = FY - 38;            // positioned HIGHER so it doesn't go below footer line
    const sigBlockWidth = 53;

    // 👉 E-SIGNATURE IMAGE — MUCH LARGER NOW: 75x40 (significantly bigger than supervisor name)
    //    Change esigW to 75 and esigH to 40 to make the signature even bigger
    if (esigBase64) {
      const esigW = 75, esigH = 40;  // Increased from 65x32 to 75x40 — much more prominent
      const esigXCenter = sigX + (sigBlockWidth - esigW) / 2 - 3;  // slight left offset for centering
      doc.addImage(esigBase64, 'PNG', esigXCenter, sigY, esigW, esigH);
    }

    // 👉 SUPERVISOR NAME + TITLE + DATE section
    //    nameY value controls the gap between e-signature image and the supervisor name
    //    Decrease the value to bring name CLOSER to signature, increase to move it further away
    let nameY = esigBase64 ? sigY + 25: sigY;  // 40mm signature + gap = 8mm spacing

    // 👉 SUPERVISOR NAME — Displays the supervisor's full name (e.g., "Juan Delacruz")
    //    Font: 7.5pt bold, color: dark gray
    //    This comes from the Appwrite SUPERVISORS_COL database
    const coordName = supervisorName || '________________________________';
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); tc(DARK);
    doc.text(coordName, sigX + sigBlockWidth / 2, nameY, { align: 'center' });

    // 👉 SUPERVISOR TITLE — Shows job position (always "OJT Coordinator / Immediate Supervisor")
    //    Font: 6.5pt normal, color: gray
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); tc(GRAY);
    doc.text('Supervisor/Cooperating Teacher', sigX + sigBlockWidth / 2, nameY + 3, { align: 'center' });

    // 👉 DOWNLOAD DATE — Shows the current date when PDF is generated
    //    Font: 6.5pt normal, color: dark gray
    //    Format: "April 28, 2026" (automatically updates based on system date)
    const downloadDate = new Date().toLocaleDateString('en-US',
      { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); tc(DARK);
    doc.text(`Date: ${downloadDate}`, sigX + sigBlockWidth / 2, nameY + 6, { align: 'center' });

    // ════════════════════════════════════════════════════════════════════
    //  STAMP FOOTER ON EVERY PAGE
    // ════════════════════════════════════════════════════════════════════
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter(p, totalPages);
    }

    doc.save(`DTR_${this.realStudentId || 'intern'}_${periodLabel.replace(/[\s–]+/g,'_')}_${ref}.pdf`);
  }

  private generateRefCode(): string {
    const now  = new Date();
    const y    = now.getFullYear();
    const m    = String(now.getMonth() + 1).padStart(2, '0');
    const d    = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id   = (this.realStudentId || 'STU').replace(/\D/g,'').slice(-4).padStart(4,'0');
    return `DTR-${y}${m}${d}-${id}-${rand}`;
  }
}