import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { ID } from 'appwrite';

interface AttendanceLog {
  $id?: string;
  student_id: string;
  student_name: string;
  student_photo: string | null;
  student_id_number: string;
  date: string;
  time_in: string;
  time_out: string;
  status: string;
  is_manual?: boolean;
  scanned_by_name?: string;
}

@Component({
  selector: 'app-admin-attendance-history',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-attendance-history.component.html',
  styleUrls: ['./admin-attendance-history.component.css']
})
export class AdminAttendanceHistoryComponent implements OnInit {

  allLogs      : AttendanceLog[] = [];
  filteredLogs : AttendanceLog[] = [];
  allStudents  : any[]           = [];
  allArchived  : any[]           = [];
  loading      = false;
  searchQuery  = '';

  // Current logged-in admin
  currentAdmin : any = null;

  // Calendar
  today           = new Date();
  month           = new Date().getMonth();
  year            = new Date().getFullYear();
  days            : number[] = [];
  firstDayOfMonth = 0;
  selectedDay     : number | null = null;
  selectedDate    = '';

  datesWithRecords: Set<string> = new Set();

  // Pagination
  currentPage = 1;
  pageSize    = 10;

  // Manual Add Modal
  showAddModal   = false;
  addLoading     = false;
  addError       = '';
  addSuccess     = false;
  studentSearch  = '';
  studentResults : any[] = [];
  selectedStudent: any   = null;

  addForm = {
    time_in : '',
    time_out: '',
    status  : 'Present',
    reason  : ''
  };

  get computedHours(): number | null {
    if (!this.addForm.time_in || !this.addForm.time_out) return null;
    const [inH, inM]   = this.addForm.time_in.split(':').map(Number);
    const [outH, outM] = this.addForm.time_out.split(':').map(Number);
    const mins = (outH * 60 + outM) - (inH * 60 + inM);
    if (mins <= 0) return null;
    return Math.round((mins / 60) * 100) / 100;
  }

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(
    private appwrite: AppwriteService,
    private router  : Router
  ) {}

  async ngOnInit() {
    await this.loadCurrentAdmin();
    await this.loadStudents();
    await this.loadLast30Days();
    this.generateCalendar();
    this.selectDay(this.today.getDate());
  }

  // ── Load current admin ────────────────────────────────────
  async loadCurrentAdmin() {
    try {
      const user = await this.appwrite.account.get();

      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ADMINS_COL
      );
      const admins = res.documents as any[];

      this.currentAdmin =
        admins.find(a => a.auth_user_id === user.$id) ?? {
          $id       : user.$id,
          first_name: user.name?.split(' ')[0] ?? 'Admin',
          last_name : user.name?.split(' ').slice(1).join(' ') ?? '',
          email     : user.email
        };
    } catch (error: any) {
      console.warn('Could not load admin profile:', error.message);
      this.currentAdmin = null;
    }
  }

  get adminFullName(): string {
    if (!this.currentAdmin) return 'Admin';
    return `${this.currentAdmin.first_name ?? ''} ${this.currentAdmin.last_name ?? ''}`.trim() || 'Admin';
  }

  // ── Load students ─────────────────────────────────────────
  async loadStudents() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      this.allStudents = res.documents as any[];

      const archiveRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ARCHIVES_COL
      );
      this.allArchived = archiveRes.documents as any[];
    } catch (error: any) {
      console.error('Failed to load students:', error.message);
    }
  }

  // ── Load attendance logs ──────────────────────────────────
  async loadLast30Days() {
    this.loading = true;
    try {
      const res     = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );
      const allDocs = res.documents as any[];

      const last30: string[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last30.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }

      const recent = allDocs.filter(d => last30.includes(d.date));
      this.datesWithRecords = new Set(recent.map(d => d.date));
      this.allLogs = recent.map(doc => this.mapDoc(doc));
    } catch (error: any) {
      console.error('Failed to load history:', error.message);
    } finally {
      this.loading = false;
    }
  }

  private mapDoc(doc: any): AttendanceLog {
    const student = this.allStudents.find(s => s.$id === doc.student_id)
          ?? this.allArchived.find(s => s.student_doc_id === doc.student_id);
    return {
      $id:               doc.$id,
      student_id:        doc.student_id,
      student_name:      student ? `${student.first_name} ${student.last_name}` : 'Unknown',
      student_photo:     student?.profile_photo_id
        ? `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${student.profile_photo_id}/view?project=${this.PROJECT_ID}`
        : null,
      student_id_number: student?.student_id || '—',
      date:              doc.date,
      time_in:           doc.time_in  || '—',
      time_out:          doc.time_out || '—',
      status:            doc.status,
      is_manual:         doc.is_manual === true,
      scanned_by_name:   doc.scanned_by_name || null
    };
  }

  // ── Calendar ──────────────────────────────────────────────
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
    const clicked = new Date(this.year, this.month, day);
    if (clicked > this.today) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    if (clicked < thirtyDaysAgo) return;

    if (this.isWeekend(day)) return;

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

  // ── Manual Add Modal ──────────────────────────────────────
  openAddModal() {
    this.showAddModal    = true;
    this.addError        = '';
    this.addSuccess      = false;
    this.studentSearch   = '';
    this.studentResults  = [];
    this.selectedStudent = null;
    this.addForm = { time_in: '', time_out: '', status: 'Present', reason: '' };
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  searchStudents() {
    const q = this.studentSearch.toLowerCase().trim();
    if (!q) { this.studentResults = []; return; }
    // Admin searches ALL students (no supervisor filter)
    this.studentResults = [...this.allStudents, ...this.allArchived].filter(s =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      (s.student_id || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }

  pickStudent(s: any) {
    this.selectedStudent = s;
    this.studentSearch   = `${s.first_name} ${s.last_name}`;
    this.studentResults  = [];
  }

  async submitManualAttendance() {
    this.addError = '';

    if (!this.selectedStudent) { this.addError = 'Please select a student.'; return; }
    if (!this.addForm.time_in)  { this.addError = 'Time In is required.'; return; }

    if (this.addForm.time_out) {
      const [inH, inM]   = this.addForm.time_in.split(':').map(Number);
      const [outH, outM] = this.addForm.time_out.split(':').map(Number);
      if ((outH * 60 + outM) <= (inH * 60 + inM)) {
        this.addError = 'Time Out must be after Time In.';
        return;
      }
    }

    const already = this.allLogs.find(
      l => l.date === this.selectedDate &&
          (l.student_id === this.selectedStudent.$id ||
           l.student_id === this.selectedStudent.student_doc_id)
    );
    if (already) {
      this.addError = 'This student already has a record for this date.';
      return;
    }

    this.addLoading = true;
    try {
      const studentDocId = this.selectedStudent.$id ?? this.selectedStudent.student_doc_id;

      const doc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL,
        ID.unique(),
        {
          student_id:      studentDocId,
          date:            this.selectedDate,
          time_in:         this.formatTimeTo12h(this.addForm.time_in),
          time_out:        this.addForm.time_out
                             ? this.formatTimeTo12h(this.addForm.time_out)
                             : null,
          status:          this.addForm.status,
          scanned_by:      this.currentAdmin?.$id ?? null,
          scanned_by_name: this.adminFullName,
          is_manual:       true,
        }
      );

      if (this.addForm.time_out && this.computedHours !== null) {
        await this.updateStudentHours(studentDocId, this.computedHours);
      }

      const newLog = this.mapDoc({ ...doc, student_id: studentDocId });
      this.allLogs.push(newLog);
      this.datesWithRecords.add(this.selectedDate);
      this.addSuccess = true;
      this.applyFilters();

      setTimeout(() => this.closeAddModal(), 1500);
    } catch (error: any) {
      this.addError = error.message || 'Failed to save record.';
    } finally {
      this.addLoading = false;
    }
  }

  private async updateStudentHours(studentDocId: string, hoursToAdd: number) {
    const activeStudent   = this.allStudents.find(s => s.$id === studentDocId);
    const archivedStudent = this.allArchived.find(s => s.student_doc_id === studentDocId);

    if (activeStudent) {
      const current = activeStudent.completed_hours ?? 0;
      const updated = Math.round((current + hoursToAdd) * 100) / 100;
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        activeStudent.$id,
        { completed_hours: updated }
      );
      activeStudent.completed_hours = updated;

    } else if (archivedStudent) {
      const current = archivedStudent.completed_hours ?? 0;
      const updated = Math.round((current + hoursToAdd) * 100) / 100;
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.ARCHIVES_COL,
        archivedStudent.$id,
        { completed_hours: updated }
      );
      archivedStudent.completed_hours = updated;
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  isToday(day: number): boolean {
    return day === this.today.getDate() &&
           this.month === this.today.getMonth() &&
           this.year  === this.today.getFullYear();
  }

  isWeekend(day: number): boolean {
    const dow = new Date(this.year, this.month, day).getDay();
    return dow === 0 || dow === 6;
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

  private formatTimeTo12h(time24: string): string {
    if (!time24) return '';
    const [hourStr, minuteStr] = time24.split(':');
    let hours   = parseInt(hourStr);
    const minutes = minuteStr;
    const period  = hours >= 12 ? 'PM' : 'AM';
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${period}`;
  }
}