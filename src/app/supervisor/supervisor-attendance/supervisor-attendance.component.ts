import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import { ID } from 'appwrite';
import Swal from 'sweetalert2';

interface AttendanceLog {
  $id?: string;
  student_id: string;
  student_name: string;
  student_photo?: string | null;
  student_id_number: string;
  date: string;
  time_in: string;
  time_out: string;
  status: string;
}

@Component({
  selector: 'app-supervisor-attendance',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SupervisorSidenavComponent, SupervisorTopnavComponent],
  templateUrl: './supervisor-attendance.component.html',
  styleUrl: './supervisor-attendance.component.css'
})
export class SupervisorAttendanceComponent implements OnInit, OnDestroy {

  isCollapsed = false;

  // Table
  todayLogs    : AttendanceLog[] = [];
  filteredLogs : AttendanceLog[] = [];
  allStudents  : any[]           = [];
  allArchived  : any[]           = [];
  loading      = false;
  searchQuery  = '';

  // Pagination
  currentPage  = 1;
  pageSize     = 10;

  // Scanner
  showScanner  = false;
  scannerTab   : 'qr' | 'manual' = 'qr';
  scanning     = false;
  scanLoading  = false;
  scanResult   = '';
  scanStatus   = '';
  lastScanned  = '';

  // Manual search (inside scanner)
  manualQuery          = '';
  manualResults        : any[] = [];
  selectedManualStudent: any   = null;

  // Manual override modal
  showOverrideModal = false;
  overrideStep      = 1;
  overrideQuery     = '';
  overrideResults   : any[] = [];
  overrideStudent   : any   = null;
  overrideDate      = '';
  overrideTimeIn    = '';
  overrideTimeOut   = '';
  overrideReason    = '';

  // Edit time modal (row-level)
  showEditModal = false;
  editLog       : AttendanceLog | null = null;
  editTimeIn    = '';
  editTimeOut   = '';
  editReason    = '';

  private stream    : MediaStream | null = null;
  private animFrame : number = 0;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadStudents();
    await this.loadTodayAttendance();
  }

  ngOnDestroy() { this.stopCamera(); }

  // ────────────────────────────────────────────
  // DATA LOADING
  // ────────────────────────────────────────────
  async loadStudents() {
    try {
      const res = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL);
      this.allStudents = res.documents as any[];

      const archiveRes = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.ARCHIVES_COL);
      this.allArchived = archiveRes.documents as any[];
    } catch (e: any) { console.error('Failed to load students:', e.message); }
  }

  async loadTodayAttendance() {
    this.loading = true;
    try {
      const now   = new Date();
      const today = this.formatDateKey(now);

      const res = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL);
      const todayDocs = (res.documents as any[]).filter(d => d.date === today);

      this.todayLogs = todayDocs.map(doc => {
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
          status:            doc.status
        };
      });

      this.applySearch();
    } catch (e: any) { console.error('Failed to load attendance:', e.message); }
    finally { this.loading = false; }
  }

  // ────────────────────────────────────────────
  // SIDEBAR / SEARCH
  // ────────────────────────────────────────────
  onToggleSidebar(collapsed: boolean) { this.isCollapsed = collapsed; }

  onSearch(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.applySearch();
  }

  applySearch() {
    const q = this.searchQuery;
    const filtered = q
      ? this.todayLogs.filter(l =>
          l.student_name.toLowerCase().includes(q) ||
          l.student_id_number.toLowerCase().includes(q))
      : [...this.todayLogs];
    this.currentPage  = 1;
    this.filteredLogs = filtered.slice(0, this.pageSize);
  }

  // ────────────────────────────────────────────
  // PAGINATION
  // ────────────────────────────────────────────
  get totalPages() { return Math.max(1, Math.ceil(this.todayLogs.length / this.pageSize)); }
  get pageNumbers() { return Array.from({ length: this.totalPages }, (_, i) => i + 1); }

  goToPage(p: number) {
    this.currentPage  = p;
    const start       = (p - 1) * this.pageSize;
    this.filteredLogs = this.todayLogs.slice(start, start + this.pageSize);
  }

  prevPage() { if (this.currentPage > 1) this.goToPage(this.currentPage - 1); }
  nextPage() { if (this.currentPage < this.totalPages) this.goToPage(this.currentPage + 1); }

  // ────────────────────────────────────────────
  // QR SCANNER MODAL
  // ────────────────────────────────────────────
  openScanner() {
    this.showScanner  = true;
    this.scannerTab   = 'qr';
    this.scanResult   = '';
    this.scanStatus   = '';
    this.lastScanned  = '';
    this.manualQuery          = '';
    this.manualResults        = [];
    this.selectedManualStudent= null;
    setTimeout(() => this.startCamera(), 500);
  }

  closeScanner() {
    this.stopCamera();
    this.showScanner = false;
    this.scanResult  = '';
    this.scanStatus  = '';
  }

  // ────────────────────────────────────────────
  // CAMERA
  // ────────────────────────────────────────────
  async startCamera() {
    this.stopCamera();
    this.scanning = true;
    await new Promise(r => setTimeout(r, 300));
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setTimeout(() => {
        const video = document.getElementById('scanner-video') as HTMLVideoElement;
        if (video) {
          video.srcObject = this.stream;
          video.onloadedmetadata = () => video.play().then(() => this.scanFrame(video)).catch(console.error);
        }
      }, 200);
    } catch (e: any) {
      this.scanning = false;
      Swal.fire({ icon: 'error', title: 'Camera Error', text: `Could not access camera: ${e.message}` });
    }
  }

  scanFrame(video: HTMLVideoElement) {
    if (!this.scanning) return;
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.height = video.videoHeight;
      canvas.width  = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      import('jsqr').then(({ default: jsQR }) => {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data !== this.lastScanned) {
          this.lastScanned = code.data;
          this.processQR(code.data);
        }
      });
    }
    this.animFrame = requestAnimationFrame(() => this.scanFrame(video));
  }

  stopCamera() {
    this.scanning = false;
    cancelAnimationFrame(this.animFrame);
    this.animFrame = 0;
    const video = document.getElementById('scanner-video') as HTMLVideoElement;
    if (video) { video.pause(); video.srcObject = null; video.load(); }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
  }

  // ────────────────────────────────────────────
  // MANUAL SEARCH (inside scanner)
  // ────────────────────────────────────────────
  onManualSearch() {
    const q = this.manualQuery.toLowerCase().trim();
    if (q.length < 2) { this.manualResults = []; return; }
    this.manualResults = this.allStudents.filter(s =>
      s.student_id?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
    ).slice(0, 6);
  }

  selectManualStudent(s: any) {
    this.selectedManualStudent = s;
    this.manualResults         = [];
  }

  clearManualStudent() {
    this.selectedManualStudent = null;
    this.manualQuery           = '';
  }

  async confirmManualStudent() {
    if (!this.selectedManualStudent) return;
    await this.processAttendance(this.selectedManualStudent.$id, 'auto');
  }

  async processManualAttendance(type: 'timein' | 'timeout') {
    if (!this.selectedManualStudent) return;
    await this.processAttendance(this.selectedManualStudent.$id, type);
  }

  // ────────────────────────────────────────────
  // CORE ATTENDANCE LOGIC
  // ────────────────────────────────────────────
  async processQR(data: string) {
    if (!data.startsWith('OJTIFY_ATTENDANCE:')) {
      Swal.fire({ icon: 'warning', title: 'Invalid QR Code', text: 'This QR code is not from OJTify.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      setTimeout(() => { this.lastScanned = ''; }, 3000);
      return;
    }
    const studentId = data.replace('OJTIFY_ATTENDANCE:', '');
    await this.processAttendance(studentId, 'auto');
  }

  async processAttendance(studentId: string, mode: 'auto' | 'timein' | 'timeout') {
    this.scanLoading = true;
    try {
      const student = this.allStudents.find(s => s.$id === studentId)
             ?? this.allArchived.find(s => s.student_doc_id === studentId);

      if (!student) {
        Swal.fire({ icon: 'error', title: 'Student Not Found', text: 'This QR code does not match any registered intern.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        setTimeout(() => { this.lastScanned = ''; }, 3000);
        return;
      }

      const studentName = `${student.first_name} ${student.last_name}`;
      const now         = new Date();
      const dayOfWeek   = now.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        Swal.fire({ icon: 'warning', title: 'Weekend!', text: 'Attendance is not recorded on weekends.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        setTimeout(() => { this.lastScanned = ''; }, 3000);
        return;
      }

      const today   = this.formatDateKey(now);
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const attendRes = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL);
      const existing  = (attendRes.documents as any[]).find(a => a.student_id === studentId && a.date === today);

      // Decide whether to time-in or time-out
      const shouldTimeOut = mode === 'timeout' || (mode === 'auto' && existing && (!existing.time_out || existing.time_out === ''));
      const shouldTimeIn  = mode === 'timein'  || (mode === 'auto' && !existing);

      if (shouldTimeOut && existing) {
        if (existing.time_out && existing.time_out !== '' && mode !== 'timeout') {
          this.scanResult = `${studentName} already completed attendance today.`;
          this.scanStatus = 'already';
          Swal.fire({ icon: 'info', title: 'Already Completed', html: `<b>${studentName}</b> already completed attendance today.`, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
          return;
        }
        await this.recordTimeOut(existing, studentId, studentName, timeStr);
      } else if (shouldTimeIn) {
        await this.recordTimeIn(studentId, student, studentName, today, timeStr);
      } else if (existing) {
        this.scanResult = `${studentName} already completed attendance today.`;
        this.scanStatus = 'already';
      }

      setTimeout(() => { this.lastScanned = ''; this.scanResult = ''; this.scanStatus = ''; }, 5000);
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    } finally {
      this.scanLoading = false;
    }
  }

  async recordTimeIn(studentId: string, student: any, studentName: string, today: string, timeStr: string) {
    const doc = await this.appwrite.databases.createDocument(
      this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL, ID.unique(),
      { student_id: studentId, date: today, time_in: timeStr, time_out: '', status: 'Present' }
    );

    this.scanResult = `Time In: ${studentName} at ${timeStr}`;
    this.scanStatus = 'timein';

    const newLog: AttendanceLog = {
      $id: doc.$id, student_id: studentId, student_name: studentName,
      student_photo: student?.profile_photo_id
        ? `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${student.profile_photo_id}/view?project=${this.PROJECT_ID}`
        : null,
      student_id_number: student?.student_id || '—',
      date: today, time_in: timeStr, time_out: '—', status: 'Present'
    };

    this.todayLogs.unshift(newLog);
    this.filteredLogs = [...this.todayLogs].slice(0, this.pageSize);

    Swal.fire({ icon: 'success', title: '✅ Time In Recorded!', html: `<b>${studentName}</b><br>${timeStr}`, toast: true, position: 'top-end', showConfirmButton: false, timer: 4000, timerProgressBar: true });
  }

  async recordTimeOut(existing: any, studentId: string, studentName: string, timeStr: string) {
    await this.appwrite.databases.updateDocument(this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL, existing.$id, { time_out: timeStr });

    const hoursWorked = this.calcHours(existing.time_in, timeStr);
    this.scanResult = `Time Out: ${studentName} at ${timeStr}`;
    this.scanStatus = 'timeout';

    if (hoursWorked > 0) {
      try {
        const studentDoc       = await this.appwrite.databases.getDocument(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL, studentId);
        const currentCompleted = Number((studentDoc as any).completed_hours) || 0;
        const requiredHours    = Number((studentDoc as any).required_hours)  || 500;
        const newCompleted     = Math.min(currentCompleted + hoursWorked, requiredHours);

        await this.appwrite.databases.updateDocument(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL, studentId, { completed_hours: newCompleted });

        const idx = this.allStudents.findIndex(s => s.$id === studentId);
        if (idx !== -1) this.allStudents[idx].completed_hours = newCompleted;

        this.scanResult = `Time Out: ${studentName} at ${timeStr} (+${hoursWorked} hrs)`;

        Swal.fire({ icon: 'success', title: '🕐 Time Out Recorded!', html: `<b>${studentName}</b><br>Time Out: ${timeStr}<br><span style="color:#16a34a;font-size:13px;font-weight:600;">+${hoursWorked} hrs added (Total: ${newCompleted} / ${requiredHours} hrs)</span>`, toast: true, position: 'top-end', showConfirmButton: false, timer: 5000, timerProgressBar: true });
      } catch (updateErr: any) {
        Swal.fire({ icon: 'error', title: 'Hours Update Failed', text: updateErr.message });
      }
    } else {
      Swal.fire({ icon: 'success', title: '🕐 Time Out Recorded!', html: `<b>${studentName}</b><br>${timeStr}`, toast: true, position: 'top-end', showConfirmButton: false, timer: 4000 });
    }

    const logIndex = this.todayLogs.findIndex(l => l.student_id === studentId);
    if (logIndex !== -1) { this.todayLogs[logIndex].time_out = timeStr; this.filteredLogs = [...this.todayLogs]; }
  }

  // ────────────────────────────────────────────
  // MANUAL OVERRIDE MODAL
  // ────────────────────────────────────────────
  openManualOverride() {
    this.showOverrideModal = true;
    this.overrideStep      = 1;
    this.overrideQuery     = '';
    this.overrideResults   = [];
    this.overrideStudent   = null;
    this.overrideDate      = this.formatDateInput(new Date());
    this.overrideTimeIn    = '';
    this.overrideTimeOut   = '';
    this.overrideReason    = '';
  }

  closeOverrideModal() { this.showOverrideModal = false; }

  onOverrideSearch() {
    const q = this.overrideQuery.toLowerCase().trim();
    if (q.length < 2) { this.overrideResults = []; return; }
    this.overrideResults = this.allStudents.filter(s =>
      s.student_id?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
    ).slice(0, 6);
  }

  selectOverrideStudent(s: any) {
    this.overrideStudent = s;
    this.overrideStep    = 2;
    this.overrideResults = [];
  }

  async saveManualOverride() {
    if (!this.overrideStudent || !this.overrideDate || !this.overrideTimeIn || !this.overrideReason) return;

    const timeInStr  = this.convertTo12Hour(this.overrideTimeIn);
    const timeOutStr = this.overrideTimeOut ? this.convertTo12Hour(this.overrideTimeOut) : '';
    const studentId  = this.overrideStudent.$id;
    const studentName= `${this.overrideStudent.first_name} ${this.overrideStudent.last_name}`;

    try {
      const attendRes = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL);
      const existing  = (attendRes.documents as any[]).find(a => a.student_id === studentId && a.date === this.overrideDate);

      if (existing) {
        await this.appwrite.databases.updateDocument(this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL, existing.$id, {
          time_in: timeInStr, time_out: timeOutStr, status: 'Present'
        });
      } else {
        await this.appwrite.databases.createDocument(this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL, ID.unique(), {
          student_id: studentId, date: this.overrideDate,
          time_in: timeInStr, time_out: timeOutStr, status: 'Present'
        });
      }

      // Update hours if time out is given
      if (timeOutStr) {
        const hoursWorked = this.calcHours(timeInStr, timeOutStr);
        if (hoursWorked > 0) {
          const studentDoc       = await this.appwrite.databases.getDocument(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL, studentId);
          const currentCompleted = Number((studentDoc as any).completed_hours) || 0;
          const requiredHours    = Number((studentDoc as any).required_hours)  || 500;
          const newCompleted     = Math.min(currentCompleted + hoursWorked, requiredHours);
          await this.appwrite.databases.updateDocument(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL, studentId, { completed_hours: newCompleted });
        }
      }

      Swal.fire({ icon: 'success', title: 'Override Saved!', html: `<b>${studentName}</b>'s attendance on <b>${this.overrideDate}</b> has been updated.<br><small style="color:#6b7280;">Reason: ${this.overrideReason}</small>`, confirmButtonColor: '#0818A8' });
      this.closeOverrideModal();
      await this.loadTodayAttendance();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    }
  }

  // ────────────────────────────────────────────
  // EDIT TIME (row-level)
  // ────────────────────────────────────────────
  openEditTime(log: AttendanceLog) {
    this.editLog     = log;
    this.editTimeIn  = this.convertTo24Hour(log.time_in);
    this.editTimeOut = log.time_out && log.time_out !== '—' ? this.convertTo24Hour(log.time_out) : '';
    this.editReason  = '';
    this.showEditModal = true;
  }

  closeEditModal() { this.showEditModal = false; this.editLog = null; }

  async saveEditTime() {
    if (!this.editLog || !this.editTimeIn || !this.editReason) return;

    const timeInStr  = this.convertTo12Hour(this.editTimeIn);
    const timeOutStr = this.editTimeOut ? this.convertTo12Hour(this.editTimeOut) : '';

    try {
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL, this.editLog.$id!,
        { time_in: timeInStr, time_out: timeOutStr }
      );

      // Recalculate hours if both times provided
      if (timeOutStr) {
        const hoursWorked = this.calcHours(timeInStr, timeOutStr);
        if (hoursWorked > 0) {
          const studentDoc       = await this.appwrite.databases.getDocument(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL, this.editLog.student_id);
          const currentCompleted = Number((studentDoc as any).completed_hours) || 0;
          const requiredHours    = Number((studentDoc as any).required_hours)  || 500;
          const newCompleted     = Math.min(currentCompleted + hoursWorked, requiredHours);
          await this.appwrite.databases.updateDocument(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL, this.editLog.student_id, { completed_hours: newCompleted });
        }
      }

      Swal.fire({ icon: 'success', title: 'Time Updated!', html: `<b>${this.editLog.student_name}</b>'s attendance has been updated.<br><small style="color:#6b7280;">Reason: ${this.editReason}</small>`, confirmButtonColor: '#0818A8' });
      this.closeEditModal();
      await this.loadTodayAttendance();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    }
  }

  // ────────────────────────────────────────────
  // UTILITIES
  // ────────────────────────────────────────────
  getToday(): string {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  formatDateInput(date: Date): string {
    return this.formatDateKey(date);
  }

  getStudentAvatarUrl(s: any): string {
    if (!s) return '';
    if (s.profile_photo_id)
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${s.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    const n = encodeURIComponent(`${s.first_name?.[0] ?? '?'}+${s.last_name?.[0] ?? '?'}`);
    return `https://ui-avatars.com/api/?name=${n}&background=2563eb&color=fff&size=64&bold=true`;
  }

  calcHours(timeIn: string, timeOut: string): number {
    try {
      const toMin = (t: string): number => {
        const parts   = t.trim().split(' ');
        const period  = parts[1];
        const tp      = parts[0].split(':');
        let hours     = parseInt(tp[0]);
        const minutes = parseInt(tp[1]);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12)  hours  = 0;
        return (hours * 60) + minutes;
      };
      let diff = toMin(timeOut) - toMin(timeIn);
      if (diff < 0) diff += 24 * 60;
      return parseFloat((diff / 60).toFixed(2));
    } catch { return 0; }
  }

  /** Convert "02:30" (24h) → "02:30 AM" (12h) */
  convertTo12Hour(time24: string): string {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr);
    const m = mStr ?? '00';
    const period = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${period}`;
  }

  /** Convert "02:30 AM" (12h) → "02:30" (24h) for input[type=time] */
  convertTo24Hour(time12: string): string {
    if (!time12 || time12 === '—') return '';
    try {
      const parts  = time12.trim().split(' ');
      const period = parts[1];
      const tp     = parts[0].split(':');
      let h        = parseInt(tp[0]);
      const m      = tp[1] ?? '00';
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h  = 0;
      return `${String(h).padStart(2, '0')}:${m}`;
    } catch { return ''; }
  }
}