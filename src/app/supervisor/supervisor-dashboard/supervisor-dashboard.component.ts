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
  assignedNames: string;
}

interface AttendanceRecord {
  intern_name: string;
  profile_photo_id?: string;
  student_id: string;
  date: string;
  time_in: string;
  time_out: string;
  status: string;
  hours_rendered?: string;
  photoFailed?: boolean;
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
  school_name?: string;
  course?: string;
}

interface InternProgress extends Student {
  fullName: string;
  photoFailed?: boolean;
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
  totalInterns   = 0;
  presentToday   = 0;
  absentToday    = 0;
  totalTasks     = 0;
  pendingTasks   = 0;
  completedTasks = 0;

  // ── Intern progress ───────────────────────────────────────
  internProgress  : InternProgress[] = [];
  studentsLoading = false;

  // ── Recent attendance ─────────────────────────────────────
  recentAttendance  : AttendanceRecord[] = [];
  attendanceLoading = false;

  // ── Recent tasks ──────────────────────────────────────────
  recentTasks  : Task[] = [];
  tasksLoading = false;

  // ── Current supervisor ────────────────────────────────────
  currentSupervisorId  = '';
  supervisorName       = '';
  supervisorFirstName  = '';

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
    this.loadAllTaskStats();

    if (!sessionStorage.getItem('supervisorWelcomeShown')) {
      sessionStorage.setItem('supervisorWelcomeShown', 'true');
      Swal.fire({
        icon: 'success',
        title: `Welcome back, ${this.supervisorFirstName || 'Supervisor'}!`,
        text: 'You are logged in as a supervisor.',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    }

    await this.checkEsigReminder();
  }

  // ── Greeting ──────────────────────────────────────────────
  get greetingTime(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  get todayDateFormatted(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // ── E-sig reminder ─────────────────────────────────────────
  private async checkEsigReminder(): Promise<void> {
    if (sessionStorage.getItem('esigReminderShown')) return;
    try {
      const user = await this.appwrite.account.get();
      const doc  = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL,
        user.$id
      );
      const hasEsig = !!(doc as any).esig_file_id;
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
    } catch { }
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
      this.supervisorFirstName = (doc as any).first_name || '';
      this.supervisorName      = `${(doc as any).first_name} ${(doc as any).last_name}`;
    } catch (error: any) {
      console.error('Failed to get supervisor:', error.message);
    }
  }

  // ── Load assigned students ────────────────────────────────
  async loadAssignedStudents() {
    this.studentsLoading = true;
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
          required_hours:   s.required_hours  || 500,
          completed_hours:  s.completed_hours || 0,
          supervisor_id:    s.supervisor_id,
          school_name:      s.school_name,
          course:           s.course,
        });
      });

      // Build progress list
      this.internProgress = assigned.map(s => ({
        $id:              s.$id,
        first_name:       s.first_name,
        middle_name:      s.middle_name,
        last_name:        s.last_name,
        profile_photo_id: s.profile_photo_id,
        required_hours:   s.required_hours  || 500,
        completed_hours:  s.completed_hours || 0,
        supervisor_id:    s.supervisor_id,
        school_name:      s.school_name,
        course:           s.course,
        fullName:         this.buildFullName(s.first_name, s.middle_name, s.last_name),
      }));

    } catch (error: any) {
      console.error('Failed to load assigned students:', error.message);
    } finally {
      this.studentsLoading = false;
    }
  }

  // ── All task stats ────────────────────────────────────────
  async loadAllTaskStats() {
    try {
      const res       = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL
      );
      const internIds = Array.from(this.studentMap.keys());
      const myTasks   = (res.documents as any[]).filter(task => {
        if (!task.assigned_intern_ids) return false;
        const ids = task.assigned_intern_ids.split(',').map((id: string) => id.trim());
        return ids.some((id: string) => internIds.includes(id));
      });
      this.totalTasks     = myTasks.length;
      this.completedTasks = myTasks.filter(t => t.status === 'completed').length;
      this.pendingTasks   = myTasks.filter(t => t.status === 'pending').length;
    } catch { }
  }

  // ── Today's stats ─────────────────────────────────────────
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

  // ── Recent attendance ─────────────────────────────────────
  async loadRecentAttendance() {
    this.attendanceLoading = true;
    try {
      const res       = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );
      const internIds = Array.from(this.studentMap.keys());
      const allDocs   = (res.documents as any[]).filter(d => internIds.includes(d.student_id));

      const rows: AttendanceRecord[] = [];

      for (let i = 0; i < 7 && rows.length < 5; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayRecords = allDocs.filter(doc => doc.date === dateStr);

        dayRecords.forEach(doc => {
          if (rows.length < 5) {
            const student = this.studentMap.get(doc.student_id);
            rows.push({
              intern_name:      student ? this.buildFullName(student.first_name, student.middle_name, student.last_name) : 'Unknown',
              profile_photo_id: student?.profile_photo_id,
              student_id:       doc.student_id,
              date:             this.formatDate(dateStr),
              time_in:          doc.time_in  || '—',
              time_out:         doc.time_out || '—',
              status:           doc.status   || 'Absent',
              hours_rendered:   this.calcHours(doc.time_in, doc.time_out),
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

  // ── Recent tasks ──────────────────────────────────────────
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
        .map(task => {
          // Resolve assigned intern names
          const ids = (task.assigned_intern_ids || '').split(',').map((id: string) => id.trim());
          const names = ids
            .map((id: string) => this.studentMap.get(id))
            .filter(Boolean)
            .map((s: any) => s.first_name + ' ' + s.last_name)
            .join(', ');

          return {
            $id:           task.$id,
            title:         task.title       || '—',
            description:   task.description || '—',
            posted:        this.formatDate(task.$createdAt.split('T')[0]),
            due:           task.due ? this.formatDate(task.due) : '—',
            status:        task.status      || 'pending',
            assignedNames: names            || '—',
          };
        });
    } catch (error: any) {
      console.error('Failed to load tasks:', error.message);
    } finally {
      this.tasksLoading = false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  onToggleSidebar(collapsed: boolean) { this.isCollapsed = collapsed; }

  buildFullName(first: string, middle: string | undefined, last: string): string {
    return `${first} ${middle ? middle + ' ' : ''}${last}`.trim();
  }

  getFullName(s: Student): string {
    return this.buildFullName(s.first_name, s.middle_name, s.last_name);
  }

  getHoursPercent(s: InternProgress): number {
    const req  = s.required_hours  || 500;
    const done = s.completed_hours || 0;
    return Math.min(parseFloat(((done / req) * 100).toFixed(1)), 100);
  }

  isOverdue(dueDateStr: string, status: string): boolean {
    if (status === 'completed' || !dueDateStr || dueDateStr === '—') return false;
    try {
      return new Date(dueDateStr) < new Date();
    } catch { return false; }
  }

  calcHours(timeIn: string, timeOut: string): string {
    if (!timeIn || !timeOut || timeIn === '—' || timeOut === '—') return '—';
    try {
      const parse = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const diff  = parse(timeOut) - parse(timeIn);
      if (diff <= 0) return '—';
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    } catch { return '—'; }
  }

  formatDate(dateStr: string): string {
    if (!dateStr || dateStr === '—') return '—';
    try {
      const parts = dateStr.split('-');
      const d     = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateStr; }
  }

  getAvatarUrl(record: AttendanceRecord): string {
    if (record.profile_photo_id && !record.photoFailed) {
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${record.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    }
    const initials = record.intern_name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('+');
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2563eb&color=fff&size=64`;
  }

  getStudentAvatarUrl(s: InternProgress): string {
    if (s.profile_photo_id && !s.photoFailed) {
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${s.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    }
    const initials = `${s.first_name[0] || ''}${s.last_name[0] || ''}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2563eb&color=fff&size=64`;
  }
}