import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { ID, Query } from 'appwrite';

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
    reason?: string | null;   // ← NEW
}

@Component({
  selector: 'app-supervisor-attendance-history',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './supervisor-attendance-history.component.html',
  styleUrls: ['./supervisor-attendance-history.component.css']
})
export class SupervisorAttendanceHistoryComponent implements OnInit {

  allLogs       : AttendanceLog[] = [];
  filteredLogs  : AttendanceLog[] = [];
  allStudents   : any[]           = [];
  allArchived   : any[]           = [];
  loading       = false;
  searchQuery   = '';

  // Current logged-in supervisor
  currentSupervisor: any = null;

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
  showAddModal    = false;
  addLoading      = false;
  addError        = '';
  addSuccess      = false;
  studentSearch   = '';
  studentResults  : any[] = [];
  selectedStudent : any   = null;

  addForm = {
    time_in : '',
    time_out: '',
    status  : 'Present',
    reason  : ''      // ← NEW: reason for manual entry
  };

  // Edit Modal
showEditModal = false;
editLoading   = false;
editError     = '';
editSuccess   = false;
editingLog    : AttendanceLog | null = null;
editForm      = { time_in: '', time_out: '', reason: '' }; 


  // Computed hours preview shown in the modal
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
    await this.loadCurrentSupervisor();
    await this.loadStudents();
    await this.loadLast30Days();
    this.generateCalendar();
    this.selectDay(this.today.getDate());
  }

  // ── Load current logged-in supervisor ────────────────

  async loadCurrentSupervisor() {
  try {
    const storedId = sessionStorage.getItem('currentDocId');
    if (!storedId) {
      this.currentSupervisor = null;
      return;
    }

    const doc = await this.appwrite.databases.getDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.SUPERVISORS_COL,
      storedId
    ) as any;

    this.currentSupervisor = doc;
  } catch (error: any) {
    console.warn('Could not load supervisor profile:', error.message);
    this.currentSupervisor = null;
  }
}

  get supervisorFullName(): string {
    if (!this.currentSupervisor) return 'Unknown Supervisor';
    return `${this.currentSupervisor.first_name ?? ''} ${this.currentSupervisor.last_name ?? ''}`.trim();
  }

  // ── Load students ─────────────────────────────────────

  async loadStudents() {
  try {
    let allStudents: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        [
          Query.limit(limit),
          Query.offset(offset)
        ]
      );
      allStudents = allStudents.concat(res.documents);
      if (allStudents.length >= res.total || res.documents.length < limit) break;
      offset += limit;
    }
    this.allStudents = allStudents;

    const archiveRes = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.ARCHIVES_COL
    );
    this.allArchived = archiveRes.documents as any[];

  } catch (error: any) {
    console.error('Failed to load students:', error.message);
  }
}
  // ── Load attendance logs ──────────────────────────────

  async loadLast30Days() {
  this.loading = true;
  try {
    // Fetch ALL attendance docs
    let allDocs: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL,
        [
          Query.limit(limit),
          Query.offset(offset)
        ]
      );
      allDocs = allDocs.concat(res.documents);
      if (allDocs.length >= res.total || res.documents.length < limit) break;
      offset += limit;
    }

    const last30: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last30.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    const assignedStudentIds = new Set(
      this.allStudents
        .filter(s => s.supervisor_id === this.currentSupervisor?.$id)
        .map(s => s.$id)
    );

    const recent = allDocs.filter(d =>
      last30.includes(d.date) && assignedStudentIds.has(d.student_id)
    );

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
    scanned_by_name:   doc.scanned_by_name || null,
    reason:            doc.reason || null          // NEW
  };
}
  // ── Calendar ──────────────────────────────────────────

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

  // ── Manual Add Modal ──────────────────────────────────

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

  this.studentResults = this.allStudents
    .filter(s => {
      if (s.supervisor_id !== this.currentSupervisor?.$id) return false;

      // Hide interns who completed their hours
      const completed = Number(s.completed_hours) || 0;
      const required  = Number(s.required_hours)  || 500;
      if (completed >= required) return false;

      return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
             (s.student_id || '').toLowerCase().includes(q);
    })
    .slice(0, 8);
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

  // ── OJT completed check ───────────────────────────────
  const studentDocId  = this.selectedStudent.$id ?? this.selectedStudent.student_doc_id;
  const activeStudent = this.allStudents.find(s => s.$id === studentDocId);
  if (activeStudent) {
    const completed = Number(activeStudent.completed_hours) || 0;
    const required  = Number(activeStudent.required_hours)  || 500;
    if (completed >= required) {
      this.addError = `${activeStudent.first_name} ${activeStudent.last_name} has already completed their required ${required} hours. No further attendance needed.`;
      return;
    }
  }

  // ── Live duplicate check ──────────────────────────────
  const dupCheck = await this.appwrite.databases.listDocuments(
    this.appwrite.DATABASE_ID,
    this.appwrite.ATTENDANCE_COL,
    [
      Query.equal('student_id', studentDocId),
      Query.equal('date', this.selectedDate),
      Query.limit(1)
    ]
  );
  if (dupCheck.documents.length > 0) {
    this.addError = 'This student already has a record for this date.';
    return;
  }

  this.addLoading = true;
  try {
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
        scanned_by:      this.currentSupervisor?.$id ?? null,
        scanned_by_name: this.supervisorFullName     ?? null,
        is_manual:       true,
        reason:          this.addForm.reason?.trim() || null   // NEW
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

// ── Edit Log ──────────────────────────────────────────

/** Parses "05:00 PM" or "17:00" into minutes since midnight. */
private timeToMinutes(t: string | null | undefined): number | null {
  if (!t || t === '—') return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3]?.toUpperCase();
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/** Converts "05:00 PM" to "17:00" for <input type="time">. */
private to24hInput(t: string | null | undefined): string {
  const mins = this.timeToMinutes(t);
  if (mins === null) return '';
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

private hoursBetween(timeIn: string | null, timeOut: string | null): number {
  const a = this.timeToMinutes(timeIn);
  const b = this.timeToMinutes(timeOut);
  if (a === null || b === null || b <= a) return 0;
  return Math.round(((b - a) / 60) * 100) / 100;
}

get editOldHours(): number {
  if (!this.editingLog) return 0;
  return this.hoursBetween(this.editingLog.time_in, this.editingLog.time_out);
}

get editNewHours(): number {
  return this.hoursBetween(this.editForm.time_in, this.editForm.time_out);
}

get editDelta(): number {
  return Math.round((this.editNewHours - this.editOldHours) * 100) / 100;
}

get editHoursChanged(): boolean {
  return this.editDelta !== 0;
}

openEditModal(log: AttendanceLog) {
  this.editingLog  = log;
  this.editError   = '';
  this.editSuccess = false;
  this.editForm = {
    time_in : this.to24hInput(log.time_in),
    time_out: this.to24hInput(log.time_out),
    reason  : log.reason ?? ''                // ← NEW
  };
  this.showEditModal = true;
}

closeEditModal() {
  this.showEditModal = false;
  this.editingLog = null;
}

async submitEdit() {
  this.editError = '';
  const log = this.editingLog;
  if (!log || !log.$id) return;

  if (!this.editForm.time_in) {
    this.editError = 'Time In is required.';
    return;
  }

  if (this.editForm.time_out) {
    const inM  = this.timeToMinutes(this.editForm.time_in)!;
    const outM = this.timeToMinutes(this.editForm.time_out)!;
    if (outM <= inM) {
      this.editError = 'Time Out must be after Time In.';
      return;
    }
  }

  const newTimeIn  = this.formatTimeTo12h(this.editForm.time_in);
  const newTimeOut = this.editForm.time_out
    ? this.formatTimeTo12h(this.editForm.time_out)
    : null;
  const newReason  = this.editForm.reason?.trim() || null;   // ← NEW

  this.editLoading = true;
  try {
    // 1. Update the attendance record
    await this.appwrite.databases.updateDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.ATTENDANCE_COL,
      log.$id,
      {
        time_in:  newTimeIn,
        time_out: newTimeOut,
        reason:   newReason            // ← NEW
      }
    );

    // 2. Adjust the intern's completed hours by the difference
    const delta = this.editDelta;
    if (delta !== 0) {
      await this.updateStudentHours(log.student_id, delta);
    }

    // 3. Reflect in the table (same object reference as allLogs / filteredLogs)
    log.time_in  = newTimeIn;
    log.time_out = newTimeOut ?? '—';
    log.reason   = newReason;          // ← NEW

    this.editSuccess = true;
    setTimeout(() => this.closeEditModal(), 1200);
  } catch (error: any) {
    this.editError = error.message || 'Failed to update record.';
  } finally {
    this.editLoading = false;
  }
}




  /**
   * Adds `hoursToAdd` to the student's completed_hours field.
   * Works for both active students and archived ones.
   */
    private async updateStudentHours(studentDocId: string, hoursToAdd: number) {
    // Find in active students first, then archived
    const activeStudent   = this.allStudents.find(s => s.$id === studentDocId);
    const archivedStudent = this.allArchived.find(s => s.student_doc_id === studentDocId);

    if (activeStudent) {
      const current = Number(activeStudent.completed_hours) || 0;                        // ← changed
      const updated = Math.max(0, Math.round((current + hoursToAdd) * 100) / 100);       // ← changed

      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        activeStudent.$id,
        { completed_hours: updated }
      );

      // Reflect in local allStudents array
      activeStudent.completed_hours = updated;

    } else if (archivedStudent) {
      const current = Number(archivedStudent.completed_hours) || 0;                      // ← changed
      const updated = Math.max(0, Math.round((current + hoursToAdd) * 100) / 100);       // ← changed

      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.ARCHIVES_COL,
        archivedStudent.$id,
        { completed_hours: updated }
      );

      archivedStudent.completed_hours = updated;
    }
  }

  // ── Helpers ───────────────────────────────────────────

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
    this.router.navigate(['/supervisor-attendance']);
  }

  private formatTimeTo12h(time24: string): string {
  if (!time24) return '';
  const [hourStr, minuteStr] = time24.split(':');
  let hours = parseInt(hourStr);
  const minutes = minuteStr;
  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${period}`;
}

}