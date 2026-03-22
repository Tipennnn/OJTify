import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
import { QRCodeComponent } from 'angularx-qrcode';
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

  showAttendanceModal = false;
  showReportsModal    = false;
  showQRModal         = false;

  selectedDate = '';
  timeIn       = '—';
  timeOut      = '—';
  status       = 'No Attendance Record';

  firstDayOfMonth = 0;
  today = new Date();
  month = this.today.getMonth();
  year  = this.today.getFullYear();
  days  : number[] = [];
  attendanceStatus : { [key: number]: string } = {};
  attendanceRecords: { [key: number]: any }    = {};

  reportFilterMonth  = '';
  reportFilterYear   = '';
  reportFilterStatus = '';
  filteredRecordsList: AttendanceRecord[] = [];
  allRecords         : AttendanceRecord[] = [];

  currentUserId = '';
  qrData        = '';

  // ── Hours tracking ────────────────────────────────────────
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
    this.generateCalendar();
    await Promise.all([
      this.loadAttendance(),
      this.loadStudentHours(),
      this.loadTodayStatus()
    ]);
    this.generateYears();
  }

  async getCurrentUser() {
    try {
      const user         = await this.appwrite.account.get();
      this.currentUserId = user.$id;
      this.qrData        = `OJTIFY_ATTENDANCE:${user.$id}`;
    } catch (error: any) {
      console.error('Failed to get user:', error.message);
    }
  }

  // ── Load student hours from students table ────────────────
  async loadStudentHours() {
  try {
    const doc = await this.appwrite.databases.getDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL,
      this.currentUserId
    );
    this.requiredHours  = (doc as any).required_hours  || 500;
    this.completedHours = (doc as any).completed_hours || 0;
  } catch (error: any) {
    console.error('Failed to load hours:', error.message);
  }
}

  // ── Load today's attendance status ────────────────────────
  async loadTodayStatus() {
    try {
      const today  = new Date().toISOString().split('T')[0];
      const res    = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );
      const todayRecord = (res.documents as any[])
        .find(d => d.student_id === this.currentUserId && d.date === today);

      this.todayStatus = todayRecord ? todayRecord.status : 'Absent';
    } catch (error: any) {
      console.error('Failed to load today status:', error.message);
    }
  }

  // ── Computed helpers ──────────────────────────────────────
  get remainingHours(): number {
    return Math.max(this.requiredHours - this.completedHours, 0);
  }

  get hoursProgress(): number {
    if (this.requiredHours === 0) return 0;
    return Math.min(Math.round((this.completedHours / this.requiredHours) * 100), 100);
  }

  async loadAttendance() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );

      const docs      = res.documents as any[];
      const myRecords = docs.filter(d => d.student_id === this.currentUserId);

      this.attendanceStatus  = {};
      this.attendanceRecords = {};
      this.allRecords        = [];

      myRecords.forEach(record => {
        const parts       = record.date.split('-');
        const recordYear  = parseInt(parts[0]);
        const recordMonth = parseInt(parts[1]) - 1;
        const recordDay   = parseInt(parts[2]);

        if (recordMonth === this.month && recordYear === this.year) {
          this.attendanceStatus[recordDay]  = record.status;
          this.attendanceRecords[recordDay] = record;
        }

        this.allRecords.push({
          $id:     record.$id,
          date:    record.date,
          day:     new Date(recordYear, recordMonth, recordDay)
                     .toLocaleString('default', { weekday: 'short' }),
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

  get monthName() {
    return new Date(this.year, this.month).toLocaleString('default', { month: 'long' });
  }
  
  getEmptyCells(): number[] {
  return Array.from({ length: this.firstDayOfMonth }, (_, i) => i);
}


  generateCalendar() {
  const totalDays  = new Date(this.year, this.month + 1, 0).getDate();
  const firstDay   = new Date(this.year, this.month, 1).getDay(); // 0=Sun, 6=Sat

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

  openAttendance(day: number) {
    const date        = new Date(this.year, this.month, day);
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

  openReportsModal() {
    this.showReportsModal = true;
    this.applyReportFilters();
  }

  closeReportsModal() { this.showReportsModal = false; }

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
  }

  downloadExcel() {
    this.applyReportFilters();
    const worksheet = XLSX.utils.json_to_sheet(this.filteredRecordsList.map(r => ({
      Date:        r.date,
      Day:         r.day,
      'Time In':   r.timeIn,
      'Time Out':  r.timeOut,
      Status:      r.status
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

  openQRModal()  { this.showQRModal = true;  }
  closeQRModal() { this.showQRModal = false; }
}