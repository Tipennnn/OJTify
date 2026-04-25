import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import { ID, Query } from 'appwrite';
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
  scanned_by_name?: string;
}

@Component({
  selector: 'app-supervisor-attendance',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SupervisorSidenavComponent,
    SupervisorTopnavComponent
  ],
  templateUrl: './supervisor-attendance.component.html',
  styleUrl: './supervisor-attendance.component.css'
})
export class SupervisorAttendanceComponent implements OnInit, OnDestroy {
  isCollapsed = false;

  todayLogs    : AttendanceLog[] = [];
  filteredLogs : AttendanceLog[] = [];
  allStudents  : any[]           = [];
  allArchived  : any[]           = [];
  loading      = false;
  searchQuery  = '';

  showScanner  = false;
  scanning     = false;
  scanLoading  = false;
  scanResult   = '';
  scanStatus   = '';
  lastScanned  = '';

  showManualEntry  = false;
  manualStudentId  = '';

  supervisorId   = '';
  supervisorName = '';

  manualSearchResults  : any[] = [];
  selectedManualStudent: any   = null;

  private stream    : MediaStream | null = null;
  private animFrame : number = 0;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadCurrentSupervisor();
    await this.loadStudents();
    await this.loadTodayAttendance();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  async loadCurrentSupervisor() {
    try {
      const user = await this.appwrite.account.get();
      this.supervisorId = user.$id;

      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL
      );
      const sup = (res.documents as any[]).find(s => s.$id === user.$id);
      if (sup) {
        this.supervisorName = `${sup.first_name} ${sup.last_name}`;
      }
    } catch (error: any) {
      console.error('Failed to get supervisor:', error.message);
    }
  }

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

  // ── PAGINATION (matches admin-ojt pattern) ─────────────────
  currentPage = 1;
  pageSize    = 9;

  get totalPages(): number {
    return Math.ceil(this.filteredLogs.length / this.pageSize) || 1;
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get pagedLogs(): AttendanceLog[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLogs.slice(start, start + this.pageSize);
  }

  /** Ghost rows to fill empty slots — keeps table height fixed */
  get ghostRows(): null[] {
    const filled = this.pagedLogs.length;
    const empty  = this.pageSize - filled;
    return empty > 0 ? Array(empty).fill(null) : [];
  }

  get rangeStart(): number {
    if (this.filteredLogs.length === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredLogs.length);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  prevPage() { this.goToPage(this.currentPage - 1); }
  nextPage() { this.goToPage(this.currentPage + 1); }
  // ──────────────────────────────────────────────────────────

  async loadTodayAttendance() {
    this.loading = true;
    try {
      const now   = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const assignedStudentIds = new Set(
        this.allStudents
          .filter(s => s.supervisor_id === this.supervisorId)
          .map(s => s.$id)
      );

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

      const todayDocs = allDocs.filter(d =>
        d.date === today && assignedStudentIds.has(d.student_id)
      );

      this.todayLogs = todayDocs.map(doc => {
        const student = this.allStudents.find(s => s.$id === doc.student_id)
               ?? this.allArchived.find(s => s.student_doc_id === doc.student_id);
        return {
          $id:               doc.$id,
          student_id:        doc.student_id,
          student_name:      student
            ? `${student.first_name} ${student.last_name}`
            : 'Unknown',
          student_photo:     student?.profile_photo_id
            ? `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${student.profile_photo_id}/view?project=${this.PROJECT_ID}`
            : null,
          student_id_number: student?.student_id || '—',
          date:              doc.date,
          time_in:           doc.time_in  || '—',
          time_out:          doc.time_out || '—',
          status:            doc.status,
          scanned_by_name:   doc.scanned_by_name || '—'
        };
      });

      this.filteredLogs = [...this.todayLogs];
      this.currentPage  = 1;

    } catch (error: any) {
      console.error('Failed to load attendance:', error.message);
    } finally {
      this.loading = false;
    }
  }

  onToggleSidebar(collapsed: boolean) {
    this.isCollapsed = collapsed;
  }

  onSearch(event: any) {
    this.searchQuery  = event.target.value.toLowerCase();
    this.filteredLogs = this.todayLogs.filter(log =>
      log.student_name.toLowerCase().includes(this.searchQuery) ||
      log.student_id_number.toLowerCase().includes(this.searchQuery)
    );
    this.currentPage = 1;
  }

  openScanner() {
    this.showScanner          = true;
    this.showManualEntry      = false;
    this.scanResult           = '';
    this.scanStatus           = '';
    this.lastScanned          = '';
    this.manualStudentId      = '';
    this.selectedManualStudent = null;
    this.manualSearchResults  = [];
    setTimeout(() => { this.startCamera(); }, 500);
  }

  closeScanner() {
    this.stopCamera();
    this.showScanner          = false;
    this.showManualEntry      = false;
    this.scanResult           = '';
    this.scanStatus           = '';
    this.manualStudentId      = '';
    this.selectedManualStudent = null;
    this.manualSearchResults  = [];
  }

  switchToCamera() {
    if (!this.showManualEntry) return;
    this.showManualEntry      = false;
    this.manualStudentId      = '';
    this.selectedManualStudent = null;
    this.manualSearchResults  = [];
    setTimeout(() => { this.startCamera(); }, 200);
  }

  switchToManual() {
    if (this.showManualEntry) return;
    this.stopCamera();
    this.showManualEntry = true;
    this.scanResult      = '';
    this.scanStatus      = '';
  }

  toggleManualEntry() {
    if (this.showManualEntry) {
      this.switchToCamera();
    } else {
      this.switchToManual();
    }
  }

  async submitManualId() {
    const inputId = this.manualStudentId.trim();
    if (!inputId && !this.selectedManualStudent) return;

    const student = this.selectedManualStudent
      ?? this.allStudents.find(
        s => s.student_id?.toLowerCase() === inputId.toLowerCase()
      );

    if (!student) {
      Swal.fire({
        icon: 'error', title: 'Student Not Found',
        text: `No intern found with ID "${inputId}".`,
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 3500
      });
      return;
    }

    this.manualStudentId       = '';
    this.selectedManualStudent = null;
    this.manualSearchResults   = [];
    await this.processManualAttendance(student);
  }

  async processManualAttendance(student: any) {
    const studentId   = student.$id;
    const studentName = `${student.first_name} ${student.last_name}`;
    const now         = new Date();
    const dayOfWeek   = now.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      Swal.fire({
        icon: 'warning', title: 'Weekend!',
        text: 'Attendance is not recorded on weekends.',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 3000
      });
      return;
    }

    const isActiveStudent = this.allStudents.some(s => s.$id === studentId);
    if (isActiveStudent) {
      const studentDoc = this.allStudents.find(s => s.$id === studentId);
      const completed  = Number(studentDoc?.completed_hours) || 0;
      const required   = Number(studentDoc?.required_hours)  || 500;
      if (completed >= required) {
        Swal.fire({
          icon: 'info',
          title: 'OJT Completed! 🎉',
          html: `<b>${studentName}</b> has already completed their required <b>${required} hours</b>.<br><br>
                 <span style="color:#16a34a; font-weight:600;">No further attendance needed.</span>`,
          confirmButtonColor: '#111827'
        });
        return;
      }
    }

    this.scanLoading = true;

    try {
      const today   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const attendRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL,
        [
          Query.equal('student_id', studentId),
          Query.equal('date', today),
          Query.limit(1)
        ]
      );

      const existing = attendRes.documents[0] ?? null;

      const scannedById   = (this as any).adminId   ?? (this as any).supervisorId;
      const scannedByName = (this as any).adminName ?? (this as any).supervisorName;

      if (existing) {
        if (!existing['time_out'] || existing['time_out'] === '') {

          await this.appwrite.databases.updateDocument(
            this.appwrite.DATABASE_ID,
            this.appwrite.ATTENDANCE_COL,
            existing.$id,
            { time_out: timeStr, scanned_by: scannedById, scanned_by_name: scannedByName }
          );

          const parseTimeToMinutes = (t: string): number => {
            try {
              const parts   = t.trim().split(' ');
              const period  = parts[1];
              const tp      = parts[0].split(':');
              let hours     = parseInt(tp[0]);
              const minutes = parseInt(tp[1]);
              if (period === 'PM' && hours !== 12) hours += 12;
              if (period === 'AM' && hours === 12)  hours  = 0;
              return (hours * 60) + minutes;
            } catch { return 0; }
          };

          const timeInMinutes  = parseTimeToMinutes(existing['time_in']);
          const timeOutMinutes = parseTimeToMinutes(timeStr);
          let diffMinutes      = timeOutMinutes - timeInMinutes;
          if (diffMinutes < 0) diffMinutes += 24 * 60;
          const hoursWorked = parseFloat((diffMinutes / 60).toFixed(2));

          if (hoursWorked > 0 && isActiveStudent) {
            try {
              const studentDoc = await this.appwrite.databases.getDocument(
                this.appwrite.DATABASE_ID,
                this.appwrite.STUDENTS_COL,
                studentId
              );
              const currentCompleted = Number((studentDoc as any).completed_hours) || 0;
              const requiredHours    = Number((studentDoc as any).required_hours)  || 500;
              const newCompleted     = Math.min(
                parseFloat((currentCompleted + hoursWorked).toFixed(2)),
                requiredHours
              );

              await this.appwrite.databases.updateDocument(
                this.appwrite.DATABASE_ID,
                this.appwrite.STUDENTS_COL,
                studentId,
                { completed_hours: newCompleted }
              );

              const idx = this.allStudents.findIndex(s => s.$id === studentId);
              if (idx !== -1) {
                this.allStudents[idx] = { ...this.allStudents[idx], completed_hours: newCompleted };
              }

              const logIndex = this.todayLogs.findIndex(l => l.student_id === studentId);
              if (logIndex !== -1) {
                this.todayLogs[logIndex].time_out        = timeStr;
                this.todayLogs[logIndex].scanned_by_name = scannedByName;
                this.filteredLogs = [...this.todayLogs];
              }

              Swal.fire({
                icon: 'success', title: '🕐 Time Out Recorded!',
                html: `<b>${studentName}</b><br>Time Out: ${timeStr}<br>
                       <span style="color:#16a34a;font-size:13px;font-weight:600;">
                         +${hoursWorked} hrs added (Total: ${newCompleted} / ${requiredHours} hrs)
                       </span>`,
                toast: true, position: 'top-end',
                showConfirmButton: false, timer: 5000, timerProgressBar: true
              });

            } catch (updateErr: any) {
              Swal.fire({ icon: 'error', title: 'Hours Update Failed', text: updateErr.message });
            }

          } else {
            const logIndex = this.todayLogs.findIndex(l => l.student_id === studentId);
            if (logIndex !== -1) {
              this.todayLogs[logIndex].time_out        = timeStr;
              this.todayLogs[logIndex].scanned_by_name = scannedByName;
              this.filteredLogs = [...this.todayLogs];
            }
            Swal.fire({
              icon: 'success', title: '🕐 Time Out Recorded!',
              html: `<b>${studentName}</b><br>Time Out: ${timeStr}`,
              toast: true, position: 'top-end',
              showConfirmButton: false, timer: 4000, timerProgressBar: true
            });
          }

        } else {
          Swal.fire({
            icon: 'info', title: 'Already Completed',
            html: `<b>${studentName}</b> already completed attendance today.`,
            toast: true, position: 'top-end',
            showConfirmButton: false, timer: 3000
          });
        }

      } else {

        const doc = await this.appwrite.databases.createDocument(
          this.appwrite.DATABASE_ID,
          this.appwrite.ATTENDANCE_COL,
          ID.unique(),
          {
            student_id:      studentId,
            date:            today,
            time_in:         timeStr,
            time_out:        '',
            status:          'Present',
            scanned_by:      scannedById,
            scanned_by_name: scannedByName,
            is_manual:       true
          }
        );

        const newLog: AttendanceLog = {
          $id:               doc.$id,
          student_id:        studentId,
          student_name:      studentName,
          student_photo:     student?.profile_photo_id
            ? `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${student.profile_photo_id}/view?project=${this.PROJECT_ID}`
            : null,
          student_id_number: student?.student_id || '—',
          date:              today,
          time_in:           timeStr,
          time_out:          '—',
          status:            'Present',
          scanned_by_name:   scannedByName
        };

        this.todayLogs.unshift(newLog);
        this.filteredLogs = [...this.todayLogs];

        Swal.fire({
          icon: 'success', title: '✅ Time In Recorded!',
          html: `<b>${studentName}</b><br>${timeStr}`,
          toast: true, position: 'top-end',
          showConfirmButton: false, timer: 4000, timerProgressBar: true
        });
      }

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    } finally {
      this.scanLoading = false;
    }
  }

  async startCamera() {
    this.stopCamera();
    this.scanning = true;

    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });

      setTimeout(() => {
        const video = document.getElementById('scanner-video') as HTMLVideoElement;
        if (video) {
          video.srcObject = this.stream;
          video.onloadedmetadata = () => {
            video.play().then(() => {
              this.scanFrame(video);
            }).catch(err => console.error('Video play error:', err));
          };
        }
      }, 200);

    } catch (error: any) {
      this.scanning = false;
      Swal.fire({ icon: 'error', title: 'Camera Error', text: `Could not access camera: ${error.message}` });
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
    if (video) {
      video.pause();
      video.srcObject = null;
      video.load();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  async processQR(data: string) {
    if (!data.startsWith('OJTIFY_ATTENDANCE:')) {
      Swal.fire({
        icon: 'warning', title: 'Invalid QR Code',
        text: 'This QR code is not from OJTify.',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 3000
      });
      setTimeout(() => { this.lastScanned = ''; }, 3000);
      return;
    }

    const parts     = data.replace('OJTIFY_ATTENDANCE:', '').split(':');
    const studentId = parts[0];
    const timestamp = parseInt(parts[1] || '0', 10);
    const ageMs     = Date.now() - timestamp;

    if (!timestamp || ageMs > 15_000 || ageMs < -5_000) {
      Swal.fire({
        icon: 'warning',
        title: 'QR Code Expired',
        text: 'This QR code has expired. Ask the intern to generate a new one.',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 4000
      });
      this.scanLoading = false;
      setTimeout(() => { this.lastScanned = ''; }, 4000);
      return;
    }

    this.scanLoading = true;

    try {
      const student = this.allStudents.find(s => s.$id === studentId)
        ?? this.allArchived.find(s => s.student_doc_id === studentId);

      if (!student) {
        Swal.fire({
          icon: 'error', title: 'Student Not Found',
          text: 'This QR code does not match any registered intern.',
          toast: true, position: 'top-end',
          showConfirmButton: false, timer: 3000
        });
        this.scanLoading = false;
        setTimeout(() => { this.lastScanned = ''; }, 3000);
        return;
      }

      if (student.supervisor_id !== this.supervisorId) {
        Swal.fire({
          icon: 'error',
          title: 'Wrong Supervisor',
          text: `${student.first_name} ${student.last_name} is not assigned to you.`,
          confirmButtonColor: '#ef4444'
        });
        this.scanLoading = false;
        setTimeout(() => { this.lastScanned = ''; }, 3000);
        return;
      }

      const studentName = `${student.first_name} ${student.last_name}`;
      const now         = new Date();
      const dayOfWeek   = now.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        Swal.fire({
          icon: 'warning', title: 'Weekend!',
          text: 'Attendance is not recorded on weekends.',
          toast: true, position: 'top-end',
          showConfirmButton: false, timer: 3000
        });
        this.scanLoading = false;
        setTimeout(() => { this.lastScanned = ''; }, 3000);
        return;
      }

      const isActiveStudent = this.allStudents.some(s => s.$id === studentId);
      if (isActiveStudent) {
        const studentDoc = this.allStudents.find(s => s.$id === studentId);
        const completed  = Number(studentDoc?.completed_hours) || 0;
        const required   = Number(studentDoc?.required_hours)  || 500;

        if (completed >= required) {
          Swal.fire({
            icon: 'info',
            title: 'OJT Completed! 🎉',
            html: `<b>${student.first_name} ${student.last_name}</b> has already completed their required <b>${required} hours</b>.<br><br>
                   <span style="color:#16a34a; font-weight:600;">No further attendance needed.</span>`,
            confirmButtonColor: '#0818A8'
          });
          this.scanLoading = false;
          setTimeout(() => { this.lastScanned = ''; }, 3000);
          return;
        }
      }

      const today   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const attendRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL,
        [
          Query.equal('student_id', studentId),
          Query.equal('date', today),
          Query.limit(1)
        ]
      );

      const existing = attendRes.documents[0] ?? null;

      if (existing) {
        if (!existing['time_out'] || existing['time_out'] === '') {

          await this.appwrite.databases.updateDocument(
            this.appwrite.DATABASE_ID,
            this.appwrite.ATTENDANCE_COL,
            existing.$id,
            {
              time_out:        timeStr,
              scanned_by:      this.supervisorId,
              scanned_by_name: this.supervisorName
            }
          );

          const parseTimeToMinutes = (t: string): number => {
            try {
              const parts   = t.trim().split(' ');
              const period  = parts[1];
              const tp      = parts[0].split(':');
              let hours     = parseInt(tp[0]);
              const minutes = parseInt(tp[1]);
              if (period === 'PM' && hours !== 12) hours += 12;
              if (period === 'AM' && hours === 12)  hours  = 0;
              return (hours * 60) + minutes;
            } catch { return 0; }
          };

          const timeInMinutes  = parseTimeToMinutes(existing['time_in']);
          const timeOutMinutes = parseTimeToMinutes(timeStr);
          let diffMinutes      = timeOutMinutes - timeInMinutes;
          if (diffMinutes < 0) diffMinutes += 24 * 60;
          const hoursWorked = parseFloat((diffMinutes / 60).toFixed(2));

          if (hoursWorked > 0 && isActiveStudent) {
            try {
              const studentDoc = await this.appwrite.databases.getDocument(
                this.appwrite.DATABASE_ID,
                this.appwrite.STUDENTS_COL,
                studentId
              );

              const currentCompleted = Number((studentDoc as any).completed_hours) || 0;
              const requiredHours    = Number((studentDoc as any).required_hours)  || 500;
              const newCompleted     = Math.min(
                parseFloat((currentCompleted + hoursWorked).toFixed(2)),
                requiredHours
              );

              await this.appwrite.databases.updateDocument(
                this.appwrite.DATABASE_ID,
                this.appwrite.STUDENTS_COL,
                studentId,
                { completed_hours: newCompleted }
              );

              const idx = this.allStudents.findIndex(s => s.$id === studentId);
              if (idx !== -1) {
                this.allStudents[idx] = {
                  ...this.allStudents[idx],
                  completed_hours: newCompleted
                };
              }

              this.scanResult = `Time Out: ${studentName} at ${timeStr} (+${hoursWorked} hrs added)`;
              this.scanStatus = 'timeout';

              const logIndex = this.todayLogs.findIndex(l => l.student_id === studentId);
              if (logIndex !== -1) {
                this.todayLogs[logIndex].time_out = timeStr;
                this.filteredLogs = [...this.todayLogs];
              }

              Swal.fire({
                icon: 'success', title: '🕐 Time Out Recorded!',
                html: `<b>${studentName}</b><br>Time Out: ${timeStr}<br>
                       <span style="color:#16a34a;font-size:13px;font-weight:600;">
                         +${hoursWorked} hrs added (Total: ${newCompleted} / ${requiredHours} hrs)
                       </span>`,
                toast: true, position: 'top-end',
                showConfirmButton: false, timer: 5000, timerProgressBar: true
              });

            } catch (updateErr: any) {
              Swal.fire({ icon: 'error', title: 'Hours Update Failed', text: updateErr.message });
            }

          } else if (hoursWorked > 0 && !isActiveStudent) {
            this.scanResult = `Time Out: ${studentName} at ${timeStr}`;
            this.scanStatus = 'timeout';

            const logIndex = this.todayLogs.findIndex(l => l.student_id === studentId);
            if (logIndex !== -1) {
              this.todayLogs[logIndex].time_out = timeStr;
              this.filteredLogs = [...this.todayLogs];
            }

            Swal.fire({
              icon: 'success', title: '🕐 Time Out Recorded!',
              html: `<b>${studentName}</b><br>Time Out: ${timeStr}`,
              toast: true, position: 'top-end',
              showConfirmButton: false, timer: 4000, timerProgressBar: true
            });

          } else {
            this.scanResult = `Time Out: ${studentName} at ${timeStr}`;
            this.scanStatus = 'timeout';
          }

        } else {
          this.scanResult = `${studentName} already completed attendance today.`;
          this.scanStatus = 'already';
          Swal.fire({
            icon: 'info', title: 'Already Completed',
            html: `<b>${studentName}</b> already completed attendance today.`,
            toast: true, position: 'top-end',
            showConfirmButton: false, timer: 3000
          });
        }

      } else {
        const doc = await this.appwrite.databases.createDocument(
          this.appwrite.DATABASE_ID,
          this.appwrite.ATTENDANCE_COL,
          ID.unique(),
          {
            student_id:      studentId,
            date:            today,
            time_in:         timeStr,
            time_out:        '',
            status:          'Present',
            scanned_by:      this.supervisorId,
            scanned_by_name: this.supervisorName
          }
        );

        this.scanResult = `Time In: ${studentName} at ${timeStr}`;
        this.scanStatus = 'timein';

        const newLog: AttendanceLog = {
          $id:               doc.$id,
          student_id:        studentId,
          student_name:      studentName,
          student_photo:     student?.profile_photo_id
            ? `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${student.profile_photo_id}/view?project=${this.PROJECT_ID}`
            : null,
          student_id_number: student?.student_id || '—',
          date:              today,
          time_in:           timeStr,
          time_out:          '—',
          status:            'Present'
        };

        this.todayLogs.unshift(newLog);
        this.filteredLogs = [...this.todayLogs];

        Swal.fire({
          icon: 'success', title: '✅ Time In Recorded!',
          html: `<b>${studentName}</b><br>${timeStr}`,
          toast: true, position: 'top-end',
          showConfirmButton: false, timer: 4000, timerProgressBar: true
        });
      }

      setTimeout(() => {
        this.lastScanned = '';
        this.scanResult  = '';
        this.scanStatus  = '';
      }, 5000);

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    } finally {
      this.scanLoading = false;
    }
  }

  getToday(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  onManualIdInput() {
    const query = this.manualStudentId.trim().toLowerCase();
    if (!query) {
      this.manualSearchResults   = [];
      this.selectedManualStudent = null;
      return;
    }

    this.manualSearchResults = this.allStudents
      .filter(s => {
        if (s.supervisor_id !== this.supervisorId) return false;

        const completed = Number(s.completed_hours) || 0;
        const required  = Number(s.required_hours)  || 500;
        if (completed >= required) return false;

        return s.student_id?.toLowerCase().includes(query) ||
               `${s.first_name} ${s.last_name}`.toLowerCase().includes(query);
      })
      .slice(0, 5);
  }

  selectManualStudent(student: any) {
    this.selectedManualStudent = student;
    this.manualStudentId       = student.student_id;
    this.manualSearchResults   = [];
  }

  clearManualSelection() {
    this.selectedManualStudent = null;
    this.manualStudentId       = '';
    this.manualSearchResults   = [];
  }
}