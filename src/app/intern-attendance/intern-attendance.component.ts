import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
import { QRCodeComponent, QRCodeModule } from 'angularx-qrcode';
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

  // PAGINATION - Reports Modal
  reportCurrentPage = 1;
  reportPageSize    = 1;
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
  statuses = ['Present','Absent','No Record'];

  constructor(private appwrite: AppwriteService) {}

 async ngOnInit() {
  await this.getCurrentUser();
  await this.loadInternStartDate(); // ✅ load this FIRST before loadAttendance
  this.generateCalendar();
  await Promise.all([
    this.loadAttendance(),
    this.loadStudentHours(),
    this.loadTodayStatus(),
  ]);
  this.calendarReady = true;
  this.generateYears();
}

  ngOnDestroy() {
    clearInterval(this.qrTimer);
  }

  // ── QR ───────────────────────────────────────────────
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
    this.qrTimer = setInterval(() => {
      this.qrExpiresIn--;
    }, 1000);
  }

  refreshQRManually() {
    clearInterval(this.qrTimer);
    this.generateFreshQR();
    this.startQRCountdown();
  }

  // ── Appwrite loaders ──────────────────────────────────
async loadStudentHours() {
  try {
    const doc = await this.appwrite.databases.getDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL,
      this.currentUserId
    );
    this.requiredHours        = (doc as any).required_hours  || 500;
    this.completedHours       = (doc as any).completed_hours || 0;
    this.realStudentId        = (doc as any).student_id      || this.currentUserId;
    this.certVerificationId   = (doc as any).cert_verification_id || ''; // 👈 ADD THIS
    if (!this.internName) this.internName = (doc as any).name || '';
  } catch (error: any) {
    console.error('Failed to load hours:', error.message);
  }
}

  async loadTodayStatus() {
    try {
      const now   = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const res   = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL,
        [Query.limit(500)]
      );
      const todayRecord = (res.documents as any[])
        .find(d => d.student_id === this.currentUserId && d.date === today);
      this.todayStatus = todayRecord ? todayRecord.status : 'Absent';
    } catch (error: any) {
      console.error('Failed to load today status:', error.message);
    }
  }

  async loadInternStartDate() {
  try {
    const doc = await this.appwrite.databases.getDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL,
      this.currentUserId
    );
    const createdAt = (doc as any).$createdAt;
    console.log('internStartDate raw:', createdAt); // ✅ add this
    if (createdAt) {
      const d = new Date(createdAt);
      d.setHours(0, 0, 0, 0);
      this.internStartDate = d;
      console.log('internStartDate set to:', this.internStartDate); // ✅ and this
    }
  } catch (error: any) {
    console.error('Failed to load intern start date:', error.message);
  }
}

  // ── Computed ──────────────────────────────────────────
  get remainingHours(): number {
    return Math.max(this.requiredHours - this.completedHours, 0);
  }

  get hoursProgress(): number {
    if (this.requiredHours === 0) return 0;
    return Math.min(parseFloat(((this.completedHours / this.requiredHours) * 100).toFixed(1)), 100);
  }

  // ── Attendance loading ────────────────────────────────
 async loadAttendance() {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.ATTENDANCE_COL,
      [Query.limit(500)]
    );

    const docs      = res.documents as any[];
    const myRecords = docs.filter(d => d.student_id === this.currentUserId);

    this.attendanceStatus  = {};
    this.attendanceRecords = {};
    this.allRecords        = [];

    const recordsByDate: { [dateStr: string]: any } = {};

    myRecords.forEach(record => {
      const parts       = record.date.split('-');
      const recordYear  = parseInt(parts[0]);
      const recordMonth = parseInt(parts[1]) - 1;
      const recordDay   = parseInt(parts[2]);

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
        status:    record.status,
        scannedBy: record.scanned_by_name || '—'
      });
    });

    // Generate synthetic Absent rows for past weekdays with no scan
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const cursor = this.internStartDate
      ? new Date(this.internStartDate)
      : new Date(now.getFullYear(), 0, 1);

    while (cursor < now) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        const yyyy    = cursor.getFullYear();
        const mm      = String(cursor.getMonth() + 1).padStart(2, '0');
        const dd      = String(cursor.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        if (!recordsByDate[dateStr]) {
          this.allRecords.push({
            date:      dateStr,
            day:       cursor.toLocaleString('default', { weekday: 'short' }),
            timeIn:    '—',
            timeOut:   '—',
            status:    'Absent',
            scannedBy: '—'
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Sort all records by date ascending
    this.allRecords.sort((a, b) => a.date.localeCompare(b.date));

    this.applyReportFilters();
  } catch (error: any) {
    console.error('Failed to load attendance:', error.message);
  }
}
  // ── Calendar ──────────────────────────────────────────
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
    now.setHours(0, 0, 0, 0);
    if (date >= now) return false;
    if (this.internStartDate && date < this.internStartDate) return false;
    if (this.attendanceStatus[day]) return false;
    return true;
  }

  // ── Modals ────────────────────────────────────────────
  openAttendance(day: number) {
  const date        = new Date(this.year, this.month, day);
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
    this.status    = 'Absent';
    this.timeIn    = '—';
    this.timeOut   = '—';
    this.scannedBy = '—';
  } else {
    this.status    = 'No Attendance Record';
    this.timeIn    = '—';
    this.timeOut   = '—';
    this.scannedBy = '—';
  }
  this.showAttendanceModal = true;
}

  closeAttendance()   { this.showAttendanceModal = false; }
  openReportsModal()  { this.showReportsModal = true; this.applyReportFilters(); }
  closeReportsModal() { this.showReportsModal = false; }
  openQRModal()       { this.showQRModal = true; }
  closeQRModal()      { this.showQRModal = false; }

  // ── Filters ───────────────────────────────────────────
  applyReportFilters() {
    this.filteredRecordsList = this.allRecords.filter(r => {
      const parts       = r.date.split('-');
      const recordYear  = parseInt(parts[0]);
      const recordMonth = parseInt(parts[1]) - 1;
      const d           = new Date(recordYear, recordMonth, parseInt(parts[2]));
      const monthMatch  = this.reportFilterMonth
        ? d.toLocaleString('default', { month: 'long' }) === this.reportFilterMonth : true;
      const yearMatch   = this.reportFilterYear
        ? d.getFullYear().toString() === this.reportFilterYear.toString() : true;
      const statusMatch = this.reportFilterStatus
        ? r.status === this.reportFilterStatus : true;
      return monthMatch && yearMatch && statusMatch;
    });
    this.reportCurrentPage = 1; // reset page on every filter change
  }

  generateYears() {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= currentYear - 5; i--) {
      this.years.push(i);
    }
  }

  // ── Helper: "YYYY-MM-DD" → "April 20, 2026" ──────────
  private formatDateLong(dateStr: string): string {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ── QR base64 builder ─────────────────────────────────
  private buildQrBase64(text: string, size: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const dynamicImport = new Function('mod', 'return import(mod)');
      dynamicImport('qrcode').then((QRCode: any) => {
        const lib = QRCode.default ?? QRCode;
        const canvas = document.createElement('canvas');
        if (lib.toCanvas) {
          lib.toCanvas(canvas, text, { width: size, margin: 1 }, (err: any) => {
            if (err) {
              lib.toDataURL(text, { width: size, margin: 1 })
                .then(resolve)
                .catch(reject);
            } else {
              resolve(canvas.toDataURL('image/png'));
            }
          });
        } else if (lib.toDataURL) {
          lib.toDataURL(text, { width: size, margin: 1 })
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error('qrcode: no compatible export found'));
        }
      }).catch(reject);
    });
  }

  // ── DTR PDF ────────────────────────────────────────────
  async downloadDTRPdf() {
  const { jsPDF } = await import('jspdf');

  this.applyReportFilters();

  const doc   = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ref   = this.generateRefCode();
  const verifyUrl = this.certVerificationId
  ? `${window.location.origin}/verify/${this.certVerificationId}`
  : `${window.location.origin}/verify/invalid`;

  type RGB = [number, number, number];
  const BLUE  : RGB = [37,  99,  235];
  const DARK  : RGB = [17,  24,  39];
  const GRAY  : RGB = [107, 114, 128];
  const LGRAY : RGB = [243, 244, 246];
  const WHITE : RGB = [255, 255, 255];
  const GREEN : RGB = [22,  163, 74];
  const RED   : RGB = [220, 38,  38];
  const BORD  : RGB = [209, 213, 219];

  const MARGIN   = 12;
  const FOOTER_H = 28;
  const usableH  = pageH - FOOTER_H - 12;

  let periodLabel = '';
  if (this.reportFilterMonth && this.reportFilterYear) {
    periodLabel = `${this.reportFilterMonth} ${this.reportFilterYear}`;
  } else if (this.reportFilterMonth) {
    periodLabel = this.reportFilterMonth;
  } else if (this.reportFilterYear) {
    periodLabel = this.reportFilterYear.toString();
  } else if (this.filteredRecordsList.length > 0) {
    const dates = this.filteredRecordsList
      .map(r => new Date(r.date))
      .filter(d => !isNaN(d.getTime()));
    if (dates.length) {
      const minD = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxD = new Date(Math.max(...dates.map(d => d.getTime())));
      const minM = minD.toLocaleString('default', { month: 'long' });
      const maxM = maxD.toLocaleString('default', { month: 'long' });
      const minY = minD.getFullYear();
      const maxY = maxD.getFullYear();
      if (minM === maxM && minY === maxY) {
        periodLabel = `${minM} ${minY}`;
      } else if (minY === maxY) {
        periodLabel = `${minM} – ${maxM} ${minY}`;
      } else {
        periodLabel = `${minM} ${minY} – ${maxM} ${maxY}`;
      }
    }
  }
  if (!periodLabel) periodLabel = 'All Records';

  const periodParts  = periodLabel.split(' ');
  const displayMonth = periodParts.length >= 2 ? periodParts.slice(0, -1).join(' ') : periodLabel;
  const displayYear  = periodParts.length >= 2 ? periodParts[periodParts.length - 1] : '';

  let footerQrBase64: string | null = null;
  try {
    footerQrBase64 = await this.buildQrBase64(verifyUrl, 120);
  } catch {
    footerQrBase64 = null;
  }

  const QR_SIZE = 20;
  const drawFooter = (pageNum: number, totalPgs: number) => {
    const fy = pageH - FOOTER_H - 3;

    doc.setFillColor(248, 250, 252);
    doc.rect(MARGIN, fy, pageW - MARGIN * 2, FOOTER_H, 'F');

    doc.setDrawColor(...BORD);
    doc.setLineWidth(0.35);
    doc.line(MARGIN, fy, pageW - MARGIN, fy);

    doc.setFillColor(...BLUE);
    doc.rect(MARGIN, fy, 2, FOOTER_H, 'F');

    const qrX = MARGIN + 4;
    const qrY = fy + (FOOTER_H - QR_SIZE) / 2;

    if (footerQrBase64) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...BORD);
      doc.setLineWidth(0.3);
      doc.roundedRect(qrX - 1, qrY - 1, QR_SIZE + 2, QR_SIZE + 2, 1.5, 1.5, 'FD');
      doc.addImage(footerQrBase64, 'PNG', qrX, qrY, QR_SIZE, QR_SIZE);
    } else {
      doc.setFillColor(237, 242, 255);
      doc.setDrawColor(...BLUE);
      doc.setLineWidth(0.4);
      doc.roundedRect(qrX - 1, qrY - 1, QR_SIZE + 2, QR_SIZE + 2, 1.5, 1.5, 'FD');
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BLUE);
      doc.text('SCAN TO\nVERIFY', qrX + QR_SIZE / 2, qrY + QR_SIZE / 2 - 1, { align: 'center' });
    }

    const tx = qrX + QR_SIZE + 5;

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text('SCAN QR TO VERIFY AUTHENTICITY', tx, fy + 5.5);

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('Document Reference:', tx, fy + 10.5);
    const refLabelW = doc.getTextWidth('Document Reference:  ');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(ref, tx + refLabelW, fy + 10.5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('Verify at:', tx, fy + 16);
    const verLabelW = doc.getTextWidth('Verify at:  ');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLUE);
    doc.text(verifyUrl, tx + verLabelW, fy + 16);
    const urlW = doc.getTextWidth(verifyUrl);
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.2);
    doc.line(tx + verLabelW, fy + 17, tx + verLabelW + urlW, fy + 17);

    doc.setFontSize(5.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(
      'This DTR is generated and verified by OJTify. If the reference code does not match any system record, this document is not valid.',
      tx, fy + 22
    );

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`Page ${pageNum} of ${totalPgs}`, pageW - MARGIN - 2, fy + FOOTER_H - 3, { align: 'right' });
  };

  let y = MARGIN;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('ON-THE-JOB TRAINING PROGRAM', pageW / 2, y + 6, { align: 'center' });

  y += 12;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('DAILY TIME RECORD', pageW / 2, y, { align: 'center' });

  y += 6;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(
    displayYear
      ? `Month: ${displayMonth}     Year: ${displayYear}`
      : `Period: ${displayMonth}`,
    pageW / 2, y, { align: 'center' }
  );

  y += 5;
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, y + 1.2, pageW - MARGIN, y + 1.2);

  y += 8;
  const col1 = MARGIN;
  const col2 = 78;
  const col3 = 148;

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('INTERN NAME',     col1, y);
  doc.text('STUDENT ID',      col2, y);
  doc.text('REQUIRED HOURS',  col3, y);

  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(this.internName    || '—', col1, y);
  doc.text(this.realStudentId || '—', col2, y);
  doc.text(`${this.requiredHours} hrs`, col3, y);

  y += 7;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('COMPLETED HOURS', col1, y);
  doc.text('REMAINING HOURS', col2, y);
  doc.text('PROGRESS',        col3, y);

  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(`${this.completedHours} hrs`, col1, y);
  doc.text(`${this.remainingHours} hrs`, col2, y);
  doc.text(`${this.hoursProgress}%`,     col3, y);

  y += 6;
  doc.setDrawColor(...BORD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, pageW - MARGIN, y);

  y += 13;
  const colX  = [12,  52,  74,  104, 134, 174];
  const colW  = [40,  22,  30,  30,   40,  26];
  const heads = ['Date', 'Day', 'Time In', 'Time Out', 'Recorded By', 'Status'];
  const rowH  = 8;

  doc.setFillColor(...BLUE);
  doc.rect(MARGIN, y, pageW - MARGIN * 2, rowH, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  heads.forEach((h, i) => {
    doc.text(h, colX[i] + colW[i] / 2, y + 5.5, { align: 'center' });
  });
  y += rowH;

  if (this.filteredRecordsList.length === 0) {
    doc.setFillColor(...LGRAY);
    doc.rect(MARGIN, y, pageW - MARGIN * 2, rowH + 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('No records found for the selected filters.', pageW / 2, y + 6, { align: 'center' });
    y += rowH + 2;
  } else {
    this.filteredRecordsList.forEach((r, idx) => {
      if (y + rowH > usableH) {
        doc.addPage();
        y = MARGIN + 8;
        doc.setFillColor(...BLUE);
        doc.rect(MARGIN, y, pageW - MARGIN * 2, rowH, 'F');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...WHITE);
        heads.forEach((h, i) => {
          doc.text(h, colX[i] + colW[i] / 2, y + 5.5, { align: 'center' });
        });
        y += rowH;
      }

      const stripe: RGB = idx % 2 === 0 ? LGRAY : WHITE;
      doc.setFillColor(...stripe);
      doc.rect(MARGIN, y, pageW - MARGIN * 2, rowH, 'F');
      doc.setDrawColor(...BORD);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + rowH, pageW - MARGIN, y + rowH);

      const formattedDate = this.formatDateLong(r.date);
      const cells = [formattedDate, r.day, r.timeIn, r.timeOut, r.scannedBy || '—', r.status];

      cells.forEach((cell, i) => {
        if (i === 5) {
          if (cell === 'Present')     doc.setTextColor(...GREEN);
          else if (cell === 'Absent') doc.setTextColor(...RED);
          else                        doc.setTextColor(...GRAY);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(...DARK);
          doc.setFont('helvetica', 'normal');
        }
        doc.setFontSize(7.5);
        const maxChars = Math.floor(colW[i] / 1.7);
        const txt = cell.length > maxChars ? cell.substring(0, maxChars) + '…' : cell;
        doc.text(txt, colX[i] + colW[i] / 2, y + 5.5, { align: 'center' });
      });

      y += rowH;
    });
  }

  // ── Fetch Supervisor Info ─────────────────────────────────────────────────
  let supervisorName = '';
  let esigBase64: string | null = null;

  try {
    const svRes = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.SUPERVISORS_COL
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
          const url = `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${svDoc.esig_file_id}/view?project=${PROJECT_ID}`;
          const res = await fetch(url, {
            headers: {
              'X-Appwrite-JWT': jwt.jwt,
              'X-Appwrite-Project': PROJECT_ID
            }
          });
          if (res.ok) {
            const blob   = await res.blob();
            const reader = new FileReader();
            esigBase64   = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror   = reject;
              reader.readAsDataURL(blob);
            });
          }
        } catch {
          esigBase64 = null;
        }
      }
    }
  } catch {
    // Signature block will render with blank lines
  }

  // ── Signature Block ───────────────────────────────────────────────────────
  if (y + 60 > usableH) {
    doc.addPage();
    y = MARGIN + 10;
  }

  y += 12;

  doc.setDrawColor(...BORD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, pageW - MARGIN, y);

  y += 10;

  const ESIG_W   = 44;
  const ESIG_H   = 22;
  const sigLineW = 72;
  const centerX  = pageW / 2;

  // E-sig centered above the line
  if (esigBase64) {
    doc.addImage(esigBase64, 'PNG', centerX - ESIG_W / 2, y, ESIG_W, ESIG_H);
  }

  const nameY = y + ESIG_H + 4;

  // Supervisor name centered above the line
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(supervisorName || '________________________', centerX, nameY, { align: 'center' });

  // Blank line centered below name
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.5);
  doc.line(centerX - sigLineW / 2, nameY + 4, centerX + sigLineW / 2, nameY + 4);

  // Role label centered
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('OJT Coordinator', centerX, nameY + 10, { align: 'center' });

  y += ESIG_H + 20;

  // ── Draw Footers on All Pages ─────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  doc.save(`DTR_${this.realStudentId || 'intern'}_${periodLabel.replace(/\s+/g, '_')}_${ref}.pdf`);
}

  // ── Reference code generator ──────────────────────────
  private generateRefCode(): string {
    const now  = new Date();
    const y    = now.getFullYear();
    const m    = String(now.getMonth() + 1).padStart(2, '0');
    const d    = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id   = (this.realStudentId || 'STU').replace(/\D/g, '').slice(-4).padStart(4, '0');
    return `DTR-${y}${m}${d}-${id}-${rand}`;
  }
}