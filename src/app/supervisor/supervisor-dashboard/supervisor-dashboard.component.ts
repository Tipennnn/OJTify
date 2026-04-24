import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';
import Swal from 'sweetalert2';

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
  supervisor_id?: string;
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

  // ── Current supervisor ────────────────────────────────────
  currentSupervisorId = '';
  supervisorName      = '';

  // ── Local student map ─────────────────────────────────────
  private studentMap: Map<string, Student> = new Map();

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
  await this.getCurrentSupervisor();
  await this.loadAssignedStudents();

  this.loadTodayStats();
  this.loadRecentAttendance();
  this.loadRecentTasks();

  // Welcome toast
  if (!sessionStorage.getItem('supervisorWelcomeShown')) {
    sessionStorage.setItem('supervisorWelcomeShown', 'true');
    Swal.fire({
      icon: 'success',
      title: `Welcome back, ${this.supervisorName || 'Supervisor'}!`,
      text: 'You are logged in as a supervisor.',
      timer: 3000,
      timerProgressBar: true,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
    });
  }

  // ← ADD THIS: E-signature reminder (every login, only if no esig)
  await this.checkEsigReminder();
}

private async checkEsigReminder(): Promise<void> {
  // ← Only show once per login session
  if (sessionStorage.getItem('esigReminderShown')) return;

  try {
    const user = await this.appwrite.account.get();
    const doc  = await this.appwrite.databases.getDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.SUPERVISORS_COL,
      user.$id
    );

    const hasEsig = !!(doc as any).esig_file_id;
    
    // ← Mark as shown regardless of whether they have esig or not
    sessionStorage.setItem('esigReminderShown', 'true');
    
    if (hasEsig) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'E-Signature Missing',
      html: `
        <p style="font-size:14px; color:#374151; margin:0 0 8px;">
          You haven't uploaded your e-signature yet.
        </p>
        <p style="font-size:13px; color:#6b7280; margin:0;">
          Your e-signature is required for signing OJT certificates and weekly reports.
        </p>
      `,
      confirmButtonText: '<i class="fas fa-signature"></i>&nbsp; Upload E-Signature',
      confirmButtonColor: '#0818A8',
      showCancelButton: true,
      cancelButtonText: 'Remind me later',
      cancelButtonColor: '#6b7280',
      allowOutsideClick: false,
      focusConfirm: false,
    });

    if (result.isConfirmed) {
      window.dispatchEvent(new CustomEvent('open-esig-upload'));
    }
  } catch { /* silently fail */ }
}


  // ── Get logged-in supervisor ──────────────────────────────
  async getCurrentSupervisor() {
    try {
      const user = await this.appwrite.account.get();
      this.currentSupervisorId = user.$id;

      const doc = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL,
        user.$id
      );
      this.supervisorName = `${(doc as any).first_name} ${(doc as any).last_name}`;
    } catch (error: any) {
      console.error('Failed to get supervisor:', error.message);
    }
  }

  // ── Load only students assigned to this supervisor ────────
  async loadAssignedStudents() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );

      const assigned = (res.documents as any[]).filter(
        s => s.supervisor_id === this.currentSupervisorId
      );

      this.totalInterns = assigned.length;

      this.studentMap.clear();
      assigned.forEach(s => {
        this.studentMap.set(s.$id, {
          $id:              s.$id,
          first_name:       s.first_name,
          middle_name:      s.middle_name,
          last_name:        s.last_name,
          profile_photo_id: s.profile_photo_id,
          required_hours:   s.required_hours,
          completed_hours:  s.completed_hours,
          supervisor_id:    s.supervisor_id,
        });
      });
    } catch (error: any) {
      console.error('Failed to load assigned students:', error.message);
    }
  }

  // ── Today's present / absent ──────────────────────────────
  async loadTodayStats() {
    try {
      const now   = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );

      const internIds    = Array.from(this.studentMap.keys());
      const todayRecords = (res.documents as any[])
        .filter(d => d.date === today && internIds.includes(d.student_id));

      const isWeekend   = now.getDay() === 0 || now.getDay() === 6;
      this.presentToday = todayRecords.filter(d => d.status === 'Present').length;
      this.absentToday  = isWeekend ? 0 : Math.max(this.totalInterns - this.presentToday, 0);

    } catch (error: any) {
      console.error('Failed to load today stats:', error.message);
    }
  }

  // ── Recent attendance (5 rows max) ───────────────────────
  async loadRecentAttendance() {
    this.attendanceLoading = true;
    try {
      const res       = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );
      const internIds = Array.from(this.studentMap.keys());

      const rows: AttendanceRecord[] = [];
      const allDocs = (res.documents as any[]).filter(d => internIds.includes(d.student_id));

      for (let i = 0; i < 5 && rows.length < 5; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const dayRecords = allDocs.filter(doc => doc.date === dateStr);

        dayRecords.forEach(doc => {
          if (rows.length < 5) {
            const student = this.studentMap.get(doc.student_id);
            rows.push({
              intern_name:      student ? this.getFullName(student) : 'Unknown',
              profile_photo_id: student?.profile_photo_id,
              student_id:       doc.student_id,
              date:             this.formatDate(dateStr),
              time_in:          doc.time_in  || '—',
              time_out:         doc.time_out || '—',
              status:           doc.status   || 'Absent',
            });
          }
        });
      }

      this.recentAttendance = rows;

    } catch (error: any) {
      console.error('Failed to load attendance:', error.message);
    } finally {
      this.attendanceLoading = false;
    }
  }

  // ── Recent tasks (3 max) ──────────────────────────────────
  async loadRecentTasks() {
    this.tasksLoading = true;
    try {
      const res       = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL
      );
      const internIds = Array.from(this.studentMap.keys());

      const myTasks = (res.documents as any[]).filter(task => {
        if (!task.assigned_intern_ids) return false;
        const ids = task.assigned_intern_ids.split(',').map((id: string) => id.trim());
        return ids.some((id: string) => internIds.includes(id));
      });

      this.recentTasks = myTasks
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
  onToggleSidebar(collapsed: boolean) { this.isCollapsed = collapsed; }

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
    } catch { return dateStr; }
  }

  getAvatarUrl(record: AttendanceRecord): string {
    if (record.profile_photo_id) {
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${record.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    }
    const initials = record.intern_name
      .split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join(' ');
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0818A8&color=fff&size=64`;
  }
}