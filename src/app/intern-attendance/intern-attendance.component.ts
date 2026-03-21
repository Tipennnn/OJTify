import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
import { QRCodeComponent } from 'angularx-qrcode';
import { ID } from 'appwrite';
import * as XLSX from 'xlsx';

interface AttendanceRecord {
  $id?: string;
  date: string;
  day: string;
  timeIn: string;
  timeOut: string;
  status: string;
}

@Component({
  selector: 'app-intern-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InternSidenavComponent,
    InternTopnavComponent,
    QRCodeComponent
  ],
  templateUrl: './intern-attendance.component.html',
  styleUrls: ['./intern-attendance.component.css']
})
export class InternAttendanceComponent implements OnInit {

  // Modal Controls
  showAttendanceModal = false;
  showReportsModal    = false;
  showQRModal         = false;

  // Selected Attendance Info
  selectedDate = '';
  timeIn       = '—';
  timeOut      = '—';
  status       = 'No Attendance Record';

  // Calendar Variables
  today = new Date();
  month = this.today.getMonth();
  year  = this.today.getFullYear();
  days  : number[] = [];
  attendanceStatus : { [key: number]: string } = {};
  attendanceRecords: { [key: number]: any }    = {};

  // Report Filters
  reportFilterMonth  = '';
  reportFilterYear   = '';
  reportFilterStatus = '';
  filteredRecordsList: AttendanceRecord[] = [];
  allRecords         : AttendanceRecord[] = [];

  // User
  currentUserId = '';
  qrData        = '';

  // Constants
  months  = ['January','February','March','April','May','June',
             'July','August','September','October','November','December'];
  years   : number[] = [];
  statuses = ['Present','Absent','No Record'];

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.getCurrentUser();
    this.generateCalendar();
    await this.loadAttendance();
    this.generateYears();
  }

  // ── Get current user ──────────────────────────────────────
  async getCurrentUser() {
    try {
      const user        = await this.appwrite.account.get();
      this.currentUserId = user.$id;
      // QR data contains the student's user ID
      this.qrData       = `OJTIFY_ATTENDANCE:${user.$id}`;
    } catch (error: any) {
      console.error('Failed to get user:', error.message);
    }
  }

  // ── Load attendance from Appwrite ─────────────────────────
  async loadAttendance() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );

      const docs = res.documents as any[];

      // Filter by current user
      const myRecords = docs.filter(d => d.student_id === this.currentUserId);

      this.attendanceStatus  = {};
      this.attendanceRecords = {};
      this.allRecords        = [];

      myRecords.forEach(record => {
        const dateObj = new Date(record.date);
        if (dateObj.getMonth() === this.month &&
            dateObj.getFullYear() === this.year) {
          const day = dateObj.getDate();
          this.attendanceStatus[day]  = record.status;
          this.attendanceRecords[day] = record;
        }

        // For reports
        this.allRecords.push({
          $id:    record.$id,
          date:   record.date,
          day:    new Date(record.date).toLocaleString('default', { weekday: 'short' }),
          timeIn:  record.time_in  || '—',
          timeOut: record.time_out || '—',
          status:  record.status
        });
      });

      this.applyReportFilters();

    } catch (error: any) {
      console.error('Failed to load attendance:', error.message);
    }
  }

  // ── Calendar ──────────────────────────────────────────────
  get monthName() {
    return new Date(this.year, this.month).toLocaleString('default', { month: 'long' });
  }

  generateCalendar() {
    const totalDays = new Date(this.year, this.month + 1, 0).getDate();
    this.days = Array.from({ length: totalDays }, (_, i) => i + 1);
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

  openAttendance(day: number) {
    const date = new Date(this.year, this.month, day);
    this.selectedDate = date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    const record = this.attendanceRecords[day];
    if (record) {
      this.status  = record.status;
      this.timeIn  = record.time_in  || '—';
      this.timeOut = record.time_out || '—';
    } else {
      this.status  = 'No Attendance Record';
      this.timeIn  = '—';
      this.timeOut = '—';
    }

    this.showAttendanceModal = true;
  }

  closeAttendance() { this.showAttendanceModal = false; }

  // ── Reports ───────────────────────────────────────────────
  openReportsModal() {
    this.showReportsModal = true;
    this.applyReportFilters();
  }

  closeReportsModal() { this.showReportsModal = false; }

  applyReportFilters() {
    this.filteredRecordsList = this.allRecords.filter(r => {
      const d           = new Date(r.date);
      const monthMatch  = this.reportFilterMonth
        ? d.toLocaleString('default', { month: 'long' }) === this.reportFilterMonth
        : true;
      const yearMatch   = this.reportFilterYear
        ? d.getFullYear().toString() === this.reportFilterYear.toString()
        : true;
      const statusMatch = this.reportFilterStatus
        ? r.status === this.reportFilterStatus
        : true;
      return monthMatch && yearMatch && statusMatch;
    });
  }

  downloadExcel() {
    this.applyReportFilters();
    const worksheet = XLSX.utils.json_to_sheet(this.filteredRecordsList.map(r => ({
      Date:    r.date,
      Day:     r.day,
      'Time In':  r.timeIn,
      'Time Out': r.timeOut,
      Status:  r.status
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    XLSX.writeFile(workbook, 'Attendance_Report.xlsx');
  }

  generateYears() {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= currentYear - 5; i--) {
      this.years.push(i);
    }
  }

  // ── QR Code Modal ─────────────────────────────────────────
  openQRModal()  { this.showQRModal = true;  }
  closeQRModal() { this.showQRModal = false; }
}