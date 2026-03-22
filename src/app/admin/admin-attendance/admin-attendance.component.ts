import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
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
  selector: 'app-admin-attendance',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    AdminSidenavComponent,
    AdminTopnavComponent
  ],
  templateUrl: './admin-attendance.component.html',
  styleUrl: './admin-attendance.component.css'
})
export class AdminAttendanceComponent implements OnInit, OnDestroy {

  // Table data
  todayLogs       : AttendanceLog[] = [];
  filteredLogs    : AttendanceLog[] = [];
  allStudents     : any[]           = [];
  loading         = false;
  searchQuery     = '';

  // Scanner
  showScanner     = false;
  scanning        = false;
  scanLoading     = false;
  scanResult      = '';
  scanStatus      = '';
  lastScanned     = '';

  private stream  : MediaStream | null = null;
  private animFrame: number = 0;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadStudents();
    await this.loadTodayAttendance();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  // ── Load all students ─────────────────────────────────────
  async loadStudents() {
    try {
      const res       = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      this.allStudents = res.documents as any[];
    } catch (error: any) {
      console.error('Failed to load students:', error.message);
    }
  }

  // ── Load today's attendance ───────────────────────────────
  async loadTodayAttendance() {
    this.loading = true;
    try {
      const today  = new Date().toISOString().split('T')[0];
      const res    = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );

      const todayDocs = (res.documents as any[])
        .filter(d => d.date === today);

      this.todayLogs = todayDocs.map(doc => {
        const student = this.allStudents.find(s => s.$id === doc.student_id);
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
          status:            doc.status
        };
      });

      this.filteredLogs = [...this.todayLogs];

    } catch (error: any) {
      console.error('Failed to load attendance:', error.message);
    } finally {
      this.loading = false;
    }
  }

  // ── Search ────────────────────────────────────────────────
  onSearch(event: any) {
    this.searchQuery  = event.target.value.toLowerCase();
    this.filteredLogs = this.todayLogs.filter(log =>
      log.student_name.toLowerCase().includes(this.searchQuery) ||
      log.student_id_number.toLowerCase().includes(this.searchQuery)
    );
  }

  // ── Open/close scanner modal ──────────────────────────────
openScanner() {
  this.showScanner  = true;
  this.scanResult   = '';
  this.scanStatus   = '';
  this.lastScanned  = '';

  // Wait 500ms for DOM + previous stream to fully release
  setTimeout(() => {
    this.startCamera();
  }, 500);
}
closeScanner() {
  this.stopCamera();
  this.showScanner = false;
  this.scanResult  = '';
  this.scanStatus  = '';
}
  // ── Start camera ──────────────────────────────────────────
async startCamera() {
  // Extra safety — stop anything still running
  this.stopCamera();
  this.scanning = true;

  // Wait 300ms after stopping before requesting new stream
  await new Promise(resolve => setTimeout(resolve, 300));

  try {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: true
    });

    setTimeout(() => {
      const video = document.getElementById('scanner-video') as HTMLVideoElement;
      if (video) {
        video.srcObject = this.stream;
        video.onloadedmetadata = () => {
          video.play().then(() => {
            this.scanFrame(video);
          }).catch(err => {
            console.error('Video play error:', err);
          });
        };
      }
    }, 200);

  } catch (error: any) {
    this.scanning = false;
    Swal.fire({
      icon: 'error',
      title: 'Camera Error',
      text: `Could not access camera: ${error.message}`
    });
  }
}

  // ── Scan frames ───────────────────────────────────────────
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

  // ── Stop camera ───────────────────────────────────────────
stopCamera() {
  this.scanning = false;
  cancelAnimationFrame(this.animFrame);
  this.animFrame = 0;

  // Clear video element first
  const video = document.getElementById('scanner-video') as HTMLVideoElement;
  if (video) {
    video.pause();
    video.srcObject = null;
    video.load();
  }

  // Then stop all tracks
  if (this.stream) {
    this.stream.getTracks().forEach(track => {
      track.stop();
    });
    this.stream = null;
  }
}
  // ── Process QR ────────────────────────────────────────────
  async processQR(data: string) {
    if (!data.startsWith('OJTIFY_ATTENDANCE:')) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid QR Code',
        text: 'This QR code is not from OJTify.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      setTimeout(() => { this.lastScanned = ''; }, 3000);
      return;
    }

    const studentId = data.replace('OJTIFY_ATTENDANCE:', '');
    this.scanLoading = true;

    try {
      // Get student info
      const student = this.allStudents.find(s => s.$id === studentId);

      if (!student) {
        Swal.fire({
          icon: 'error',
          title: 'Student Not Found',
          text: 'This QR code does not match any registered intern.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
        this.scanLoading = false;
        setTimeout(() => { this.lastScanned = ''; }, 3000);
        return;
      }

      const studentName = `${student.first_name} ${student.last_name}`;
      const today       = new Date().toISOString().split('T')[0];
      const now         = new Date();
      const timeStr     = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      // Check existing attendance
      const attendRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );

      const existing = (attendRes.documents as any[])
        .find(a => a.student_id === studentId && a.date === today);

      if (existing) {
       if (!existing.time_out || existing.time_out === '') {
  // Record time out
  await this.appwrite.databases.updateDocument(
    this.appwrite.DATABASE_ID,
    this.appwrite.ATTENDANCE_COL,
    existing.$id,
    { time_out: timeStr }
  );

  // ── Calculate hours worked ────────────────────────
  const timeInDate  = new Date(`${today} ${existing.time_in}`);
  const timeOutDate = new Date(`${today} ${timeStr}`);
  const diffMs      = timeOutDate.getTime() - timeInDate.getTime();
  const hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10; // 1 decimal

  // ── Update completed hours in students table ──────
  if (hoursWorked > 0) {
    const studentDoc = await this.appwrite.databases.getDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL,
      studentId
    );
    const currentCompleted = (studentDoc as any).completed_hours || 0;
    const requiredHours    = (studentDoc as any).required_hours  || 500;
    const newCompleted     = Math.min(
      currentCompleted + hoursWorked,
      requiredHours
    );

    await this.appwrite.databases.updateDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL,
      studentId,
      { completed_hours: newCompleted }
    );
  }

  this.scanResult = `Time Out: ${studentName} at ${timeStr} (+${hoursWorked}hrs)`;
  this.scanStatus = 'timeout';

  // Update local log
  const logIndex = this.todayLogs.findIndex(l => l.student_id === studentId);
  if (logIndex !== -1) {
    this.todayLogs[logIndex].time_out = timeStr;
    this.filteredLogs = [...this.todayLogs];
  }

  Swal.fire({
    icon: 'success',
    title: '🕐 Time Out Recorded!',
    html: `<b>${studentName}</b><br>${timeStr}<br>
           <span style="font-size:13px; color:#16a34a;">
             +${hoursWorked} hrs added
           </span>`,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true
  });

        } else {
          this.scanResult = `${studentName} already completed attendance today.`;
          this.scanStatus = 'already';

          Swal.fire({
            icon: 'info',
            title: 'Already Completed',
            html: `<b>${studentName}</b> has already completed attendance today.`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
          });
        }

      } else {
        // Record time in
        const doc = await this.appwrite.databases.createDocument(
          this.appwrite.DATABASE_ID,
          this.appwrite.ATTENDANCE_COL,
          ID.unique(),
          {
            student_id: studentId,
            date:       today,
            time_in:    timeStr,
            time_out:   '',
            status:     'Present'
          }
        );

        this.scanResult = `Time In: ${studentName} at ${timeStr}`;
        this.scanStatus = 'timein';

        // Add to local log immediately
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
          icon: 'success',
          title: '✅ Time In Recorded!',
          html: `<b>${studentName}</b><br>${timeStr}`,
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true
        });
      }

      // Allow re-scan after 5 seconds
      setTimeout(() => {
        this.lastScanned = '';
        this.scanResult  = '';
        this.scanStatus  = '';
      }, 5000);

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message
      });
    } finally {
      this.scanLoading = false;
    }
  }

  getToday(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric',
      month: 'long', day: 'numeric'
    });
  }
}