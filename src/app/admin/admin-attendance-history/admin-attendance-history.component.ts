import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';

interface AttendanceLog {
  student_id: string;
  student_name: string;
  student_photo: string | null;
  student_id_number: string;
  date: string;
  time_in: string;
  time_out: string;
  status: string;
}

@Component({
  selector: 'app-admin-attendance-history',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-attendance-history.component.html',
  styleUrls: ['./admin-attendance-history.component.css']
})
export class AdminAttendanceHistoryComponent implements OnInit {

  allLogs       : AttendanceLog[] = [];
  filteredLogs  : AttendanceLog[] = [];
  allStudents   : any[]           = [];
  allArchived : any[] = [];  // ← add this
  loading       = false;
  searchQuery   = '';

  // Calendar
  today         = new Date();
  month         = new Date().getMonth();
  year          = new Date().getFullYear();
  days          : number[] = [];
  firstDayOfMonth = 0;
  selectedDay   : number | null = null;
  selectedDate  = '';

  // Which dates have records (for highlighting)
  datesWithRecords: Set<string> = new Set();

  // Pagination
  currentPage   = 1;
  pageSize      = 10;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(
    private appwrite: AppwriteService,
    private router  : Router
  ) {}

  async ngOnInit() {
    await this.loadStudents();
    await this.loadLast30Days();
    this.generateCalendar();

    // Default: select today
    this.selectDay(this.today.getDate());
  }

  async loadStudents() {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL
    );
    this.allStudents = res.documents as any[];

    // Also load archived so their names resolve in history
    const archiveRes = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.ARCHIVES_COL
    );
    this.allArchived = archiveRes.documents as any[];

  } catch (error: any) {
    console.error('Failed to load students:', error.message);
  }
}

  async loadLast30Days() {
    this.loading = true;
    try {
      const res     = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );
      const allDocs = res.documents as any[];

      // Build last 30 days date strings
      const last30: string[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last30.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }

      const recent = allDocs.filter(d => last30.includes(d.date));

      // Track which dates have records
      this.datesWithRecords = new Set(recent.map(d => d.date));

      this.allLogs = recent.map(doc => {
        const student = this.allStudents.find(s => s.$id === doc.student_id)
             ?? this.allArchived.find(s => s.student_doc_id === doc.student_id);
        return {
          student_id:        doc.student_id,
          student_name:      student
            ? `${student.first_name} ${student.last_name}` : 'Unknown',
          student_photo:     student?.profile_photo_id
            ? `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${student.profile_photo_id}/view?project=${this.PROJECT_ID}`
            : null,
          student_id_number: student?.student_id || '—',
          date:              doc.date,
          time_in:           doc.time_in  || '—',
          time_out:          doc.time_out || '—',
          status:            doc.status
        };
      });

    } catch (error: any) {
      console.error('Failed to load history:', error.message);
    } finally {
      this.loading = false;
    }
  }

  generateCalendar() {
    const totalDays      = new Date(this.year, this.month + 1, 0).getDate();
    this.firstDayOfMonth = new Date(this.year, this.month, 1).getDay();
    this.days            = Array.from({ length: totalDays }, (_, i) => i + 1);
  }

  getEmptyCells(): number[] {
    return Array.from({ length: this.firstDayOfMonth }, (_, i) => i);
  }

  get monthName(): string {
    return new Date(this.year, this.month).toLocaleString('default', { month: 'long' });
  }

  prevMonth() {
    this.month--;
    if (this.month < 0) { this.month = 11; this.year--; }
    this.generateCalendar();
    this.selectedDay  = null;
    this.selectedDate = '';
    this.filteredLogs = [];
    this.searchQuery  = '';
  }

  nextMonth() {
    // Don't allow going to future months
    const now = new Date();
    if (this.year === now.getFullYear() && this.month >= now.getMonth()) return;
    this.month++;
    if (this.month > 11) { this.month = 0; this.year++; }
    this.generateCalendar();
    this.selectedDay  = null;
    this.selectedDate = '';
    this.filteredLogs = [];
    this.searchQuery  = '';
  }

  selectDay(day: number) {
    // Don't allow future dates
    const clicked = new Date(this.year, this.month, day);
    if (clicked > this.today) return;

    // Don't allow dates older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    if (clicked < thirtyDaysAgo) return;

    this.selectedDay  = day;
    this.selectedDate = `${this.year}-${String(this.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    this.currentPage  = 1;
    this.searchQuery  = '';
    this.applyFilters();
  }

  applyFilters() {
    let logs = this.allLogs.filter(l => l.date === this.selectedDate);

    if (this.searchQuery) {
      logs = logs.filter(l =>
        l.student_name.toLowerCase().includes(this.searchQuery) ||
        l.student_id_number.toLowerCase().includes(this.searchQuery)
      );
    }

    this.filteredLogs = logs;
  }

  onSearch(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.currentPage = 1;
    this.applyFilters();
  }

  isToday(day: number): boolean {
    return day === this.today.getDate() &&
           this.month === this.today.getMonth() &&
           this.year  === this.today.getFullYear();
  }

  isWeekend(day: number): boolean {
    return new Date(this.year, this.month, day).getDay() === 0 ||
           new Date(this.year, this.month, day).getDay() === 6;
  }

  isFuture(day: number): boolean {
    return new Date(this.year, this.month, day) > this.today;
  }

  isOlderThan30Days(day: number): boolean {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    return new Date(this.year, this.month, day) < thirtyDaysAgo;
  }

  hasRecord(day: number): boolean {
    const dateStr = `${this.year}-${String(this.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return this.datesWithRecords.has(dateStr);
  }

  formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const d     = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // ── Pagination ────────────────────────────────────────────
  get totalPages(): number {
    return Math.ceil(this.filteredLogs.length / this.pageSize);
  }

  get paginatedLogs(): AttendanceLog[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLogs.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  goBack() {
    this.router.navigate(['/admin-attendance']);
  }
}