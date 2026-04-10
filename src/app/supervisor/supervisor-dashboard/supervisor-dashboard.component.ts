import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';

interface Task {
  $id?: string;
  title: string;
  description: string;
  posted: string;
  due: string;
  status: 'completed' | 'pending';
}

interface AttendanceRecord {
  intern_name: string;
  profile_photo_id?: string;
  student_id: string;
  date: string;
  time_in: string;
  time_out: string;
  status: string;
}

interface Student {
  $id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  profile_photo_id?: string;
  required_hours?: number;
  completed_hours?: number;
}

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SupervisorSidenavComponent,
    SupervisorTopnavComponent
  ],
  templateUrl: './supervisor-dashboard.component.html',
  styleUrls: ['./supervisor-dashboard.component.css']
})
export class SupervisorDashboardComponent implements OnInit {

  isCollapsed = false;

  // ── Stat cards ────────────────────────────────────────────
  totalInterns  = 0;
  presentToday  = 0;
  absentToday   = 0;

  // ── Recent attendance ─────────────────────────────────────
  recentAttendance  : AttendanceRecord[] = [];
  attendanceLoading = false;

  // ── Recent tasks ──────────────────────────────────────────
  recentTasks  : Task[] = [];
  tasksLoading = false;

  // ── Local student map for name/avatar lookup ──────────────
  private studentMap: Map<string, Student> = new Map();

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadStudents();
    this.loadTodayStats();
    this.loadRecentAttendance();
    this.loadRecentTasks();
  }

  // ── Load all active interns ───────────────────────────────
  async loadStudents() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      const students = (res.documents as any[]).filter(s => {
        const completed = s.completed_hours || 0;
        const required  = s.required_hours  || 500;
        return completed < required;
      });

      this.totalInterns = students.length;

      // Build map for quick lookup
      students.forEach(s => {
        this.studentMap.set(s.$id, {
          $id:              s.$id,
          first_name:       s.first_name,
          middle_name:      s.middle_name,
          last_name:        s.last_name,
          profile_photo_id: s.profile_photo_id,
          required_hours:   s.required_hours,
          completed_hours:  s.completed_hours,
        });
      });
    } catch (error: any) {
      console.error('Failed to load students:', error.message);
    }
  }

  // ── Today's present / absent counts ──────────────────────
  async loadTodayStats() {
    try {
      const now   = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );

      const todayRecords = (res.documents as any[]).filter(d => d.date === today);

      // Only count records for interns in our student map
      const internIds = Array.from(this.studentMap.keys());
      const relevant  = todayRecords.filter(d => internIds.includes(d.student_id));

      this.presentToday = relevant.filter(d => d.status === 'Present').length;
      this.absentToday  = this.totalInterns - this.presentToday;

    } catch (error: any) {
      console.error('Failed to load today stats:', error.message);
    }
  }

  // ── Recent attendance (last 5 records across all interns) ─
  async loadRecentAttendance() {
    this.attendanceLoading = true;
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );

      const internIds = Array.from(this.studentMap.keys());

      this.recentAttendance = (res.documents as any[])
        .filter(d => internIds.includes(d.student_id))
        .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())
        .slice(0, 10)
        .map(d => {
          const student = this.studentMap.get(d.student_id);
          return {
            intern_name:      student ? this.getFullName(student) : 'Unknown',
            profile_photo_id: student?.profile_photo_id,
            student_id:       d.student_id,
            date:             this.formatDate(d.date),
            time_in:          d.time_in  || '—',
            time_out:         d.time_out || '—',
            status:           d.status   || 'Absent',
          };
        });

    } catch (error: any) {
      console.error('Failed to load attendance:', error.message);
    } finally {
      this.attendanceLoading = false;
    }
  }

  // ── Recent tasks (last 3) ─────────────────────────────────
  async loadRecentTasks() {
    this.tasksLoading = true;
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL
      );

      this.recentTasks = (res.documents as any[])
        .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())
        .slice(0, 3)
        .map(task => ({
          $id:         task.$id,
          title:       task.title       || '—',
          description: task.description || '—',
          posted:      this.formatDate(task.$createdAt.split('T')[0]),
          due:         task.due_date ? this.formatDate(task.due_date) : '—',
          status:      task.status      || 'pending',
        }));

    } catch (error: any) {
      console.error('Failed to load tasks:', error.message);
    } finally {
      this.tasksLoading = false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  onToggleSidebar(collapsed: boolean) {
    this.isCollapsed = collapsed;
  }

  getFullName(s: Student): string {
    return `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr || dateStr === '—') return '—';
    try {
      const parts = dateStr.split('-');
      const d     = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  getAvatarUrl(record: AttendanceRecord): string {
    if (record.profile_photo_id) {
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${record.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    }
    const initials = record.intern_name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .slice(0, 2)
      .join(' ');
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0818A8&color=fff&size=64`;
  }
}