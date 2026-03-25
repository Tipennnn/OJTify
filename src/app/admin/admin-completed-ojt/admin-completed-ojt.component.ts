import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import { Query } from 'appwrite';

interface Student {
  $id: string;
  student_doc_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  student_id: string;
  email: string;
  contact_number?: string;
  birthday?: string;
  gender?: string;
  home_address?: string;
  school_name?: string;
  course?: string;
  year_level?: string;
  profile_photo_id?: string;
  required_hours?: number;
  completed_hours?: number;
  ojt_start: string;
  ojt_end: string;
  archived_at: string;
}

interface AttendanceLog {
  date: string;
  time_in: string;
  time_out: string;
  status: string;
}

@Component({
  selector: 'app-admin-completed-ojt',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AdminSidenavComponent,
    AdminTopnavComponent
  ],
  templateUrl: './admin-completed-ojt.component.html',
  styleUrls: ['./admin-completed-ojt.component.css']
})
export class AdminCompletedOjtComponent implements OnInit {
  isCollapsed = false;
  loading = false;

  students: Student[] = [];
  filteredStudents: Student[] = [];
  searchQuery = '';

  years: number[] = [];
  months: string[] = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

  showModal = false;
  selectedStudent: Student | null = null;

  // Attendance logs modal
  showAttendanceLogsModal = false;
  attendanceLogs: AttendanceLog[] = [];
  attendanceLoading = false;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    this.populateYears();
    await this.loadCompletedStudents();
  }

  async loadCompletedStudents() {
    this.loading = true;
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ARCHIVES_COL
      );
      this.students         = res.documents as any[];
      this.filteredStudents = [...this.students];
    } catch (error: any) {
      console.error('Failed to load archived students:', error.message);
    } finally {
      this.loading = false;
    }
  }

  async loadAttendanceLogs(student: Student) {
    this.attendanceLoading = true;
    this.attendanceLogs = [];
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL,
        [
          Query.equal('student_id', student.student_doc_id),
          Query.orderAsc('date'),
          Query.limit(200)
        ]
      );
      this.attendanceLogs = (res.documents as any[]).map(doc => ({
        date:     doc.date,
        time_in:  doc.time_in  || '—',
        time_out: doc.time_out || '—',
        status:   doc.status
      }));
    } catch (error: any) {
      console.error('Failed to load attendance logs:', error.message);
    } finally {
      this.attendanceLoading = false;
    }
  }

  onToggleSidebar(collapsed: boolean) { this.isCollapsed = collapsed; }

  populateYears() {
    const currentYear = new Date().getFullYear();
    this.years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) this.years.push(i);
  }

  onSearch(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.filteredStudents = this.students.filter(s => {
      const fullName = `${s.first_name} ${s.middle_name ?? ''} ${s.last_name}`.toLowerCase();
      return fullName.includes(this.searchQuery) ||
             s.student_id.toLowerCase().includes(this.searchQuery) ||
             s.email.toLowerCase().includes(this.searchQuery);
    });
  }

  getFullName(s: Student | null) {
    if (!s) return '';
    return `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`;
  }

  getStartDate(s: Student | null) {
    if (!s?.ojt_start) return '—';
    return new Date(s.ojt_start).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  getEndDate(s: Student | null) {
    if (!s?.ojt_end) return '—';
    return new Date(s.ojt_end).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  getAvatarUrl(s: Student | null) {
    if (!s) return 'assets/default-avatar.png';
    if (s.profile_photo_id) {
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${s.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    }
    const initials = `${s.first_name.charAt(0)} ${s.last_name.charAt(0)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2563eb&color=fff&size=64`;
  }

  getRemainingHours(s: Student | null) {
    if (!s) return 0;
    const req  = s.required_hours  || 500;
    const comp = s.completed_hours || 0;
    return Math.max(req - comp, 0);
  }

  openModal(student: Student) {
    this.selectedStudent      = student;
    this.showModal            = true;
    this.showAttendanceLogsModal = false;
    this.attendanceLogs       = [];
  }

  closeModal() {
    this.showModal            = false;
    this.selectedStudent      = null;
    this.showAttendanceLogsModal = false;
    this.attendanceLogs       = [];
  }

  async openAttendanceLogsModal() {
    this.showAttendanceLogsModal = true;
    if (this.attendanceLogs.length === 0) {
      await this.loadAttendanceLogs(this.selectedStudent!);
    }
  }

  closeAttendanceLogsModal() {
    this.showAttendanceLogsModal = false;
    this.attendanceLogs = [];
  }
}