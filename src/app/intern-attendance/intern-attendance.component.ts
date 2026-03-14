import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import * as XLSX from 'xlsx';

interface AttendanceRecord {
  date: string;
  day: string;
  timeIn: string;
  timeOut: string;
  status: string;
}

@Component({
  selector: 'app-intern-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, InternSidenavComponent, InternTopnavComponent],
  templateUrl: './intern-attendance.component.html',
  styleUrls: ['./intern-attendance.component.css']
})
export class InternAttendanceComponent {
  // Modal Controls
  showAttendanceModal = false;
  showReportsModal = false;
  showQRModal = false;

  // Selected Attendance Info
  selectedDate = '';
  timeIn = '—';
  timeOut = '—';
  status = 'No Attendance Record';

  // Calendar Variables
  today = new Date();
  month = this.today.getMonth();
  year = this.today.getFullYear();
  days: number[] = [];
  attendanceStatus: any = {};
  records: AttendanceRecord[] = [];

  // Report Filters
  reportFilterMonth = '';
  reportFilterYear = '';
  reportFilterStatus = '';
  filteredRecordsList: AttendanceRecord[] = [];

  // Constants
  months: string[] = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  years: number[] = [];
  statuses: string[] = ['Present','Absent','No Record'];

  ngOnInit() {
    this.generateCalendar();
    this.generateDummyRecords();
    this.generateYears();
  }

  // ------------------ Calendar & Attendance ------------------

  get monthName() {
    return new Date(this.year, this.month).toLocaleString('default', { month: 'long' });
  }

  generateCalendar() {
    const totalDays = new Date(this.year, this.month + 1, 0).getDate();
    this.days = Array.from({ length: totalDays }, (_, i) => i + 1);
    this.attendanceStatus = {};
    this.days.forEach(day => {
      if (!this.isWeekend(day)) {
        this.attendanceStatus[day] = Math.random() > 0.3 ? 'Present' : 'Absent';
      }
    });
  }

  isWeekend(day: number) {
    const date = new Date(this.year, this.month, day);
    return date.getDay() === 0 || date.getDay() === 6;
  }

  prevMonth() {
    this.month--;
    if (this.month < 0) { this.month = 11; this.year--; }
    this.generateCalendar();
  }

  nextMonth() {
    this.month++;
    if (this.month > 11) { this.month = 0; this.year++; }
    this.generateCalendar();
  }

  openAttendance(day: number) {
    const date = new Date(this.year, this.month, day);
    this.selectedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    if (this.isWeekend(day)) {
      this.status = 'No Attendance Record';
      this.timeIn = '—';
      this.timeOut = '—';
    } else {
      this.status = this.attendanceStatus[day];
      this.timeIn = this.status === 'Present' ? '8:00 AM' : '—';
      this.timeOut = this.status === 'Present' ? '5:00 PM' : '—';
    }

    this.showAttendanceModal = true;
  }

  closeAttendance() { this.showAttendanceModal = false; }

  // ------------------ Reports Modal ------------------

  openReportsModal() {
    this.showReportsModal = true;
    this.applyReportFilters();
  }

  closeReportsModal() { this.showReportsModal = false; }

  generateDummyRecords() {
    const totalDays = new Date(this.year, this.month + 1, 0).getDate();
    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(this.year, this.month, day);
      const dayName = dateObj.toLocaleString('default', { weekday: 'short' });
      const status = this.isWeekend(day) ? 'No Record' : (Math.random() > 0.3 ? 'Present' : 'Absent');
      this.records.push({
        date: dateObj.toLocaleDateString(),
        day: dayName,
        timeIn: status === 'Present' ? '8:00 AM' : '—',
        timeOut: status === 'Present' ? '5:00 PM' : '—',
        status: status
      });
    }
  }

  applyReportFilters() {
    this.filteredRecordsList = this.records.filter(r => {
      const monthMatch = this.reportFilterMonth ? new Date(r.date).toLocaleString('default', { month: 'long' }) === this.reportFilterMonth : true;
      const yearMatch = this.reportFilterYear ? new Date(r.date).getFullYear().toString() === this.reportFilterYear : true;
      const statusMatch = this.reportFilterStatus ? r.status === this.reportFilterStatus : true;
      return monthMatch && yearMatch && statusMatch;
    });
  }

  downloadExcel() {
    this.applyReportFilters();
    const worksheet = XLSX.utils.json_to_sheet(this.filteredRecordsList);
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

  // ------------------ QR Code Modal ------------------

  openQRModal() { this.showQRModal = true; }
  closeQRModal() { this.showQRModal = false; }
}