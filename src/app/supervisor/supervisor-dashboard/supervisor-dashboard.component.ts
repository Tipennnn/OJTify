import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';
import Swal from 'sweetalert2';
import { Query } from 'appwrite';


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

  // ── Fetch ALL docs of a collection (no 25-doc default cap) ─
  // Uses cursor pagination, so it does NOT require any DB index.
  private async fetchAll(collectionId: string, queries: string[] = []): Promise<any[]> {
    const PAGE = 100;
    let all: any[] = [];
    let cursor: string | null = null;

    while (true) {
      const q = [...queries, Query.limit(PAGE)];
      if (cursor) q.push(Query.cursorAfter(cursor));

      const res: any = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        collectionId,
        q
      );

      all = all.concat(res.documents);
      if (res.documents.length < PAGE) break;
      cursor = res.documents[res.documents.length - 1].$id;
    }
    return all;
  }

  // ── Today's attendance docs for my interns (newest first) ──
  // Filters by date in code (the `date` column has no index, so
  // Query.equal('date', ...) would make Appwrite throw).
  private async getTodayAttendanceDocs(): Promise<any[]> {
    const now   = new Date();
    const iso   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const pretty = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.ATTENDANCE_COL,
      [Query.orderDesc('$createdAt'), Query.limit(200)]
    );

    const internIds = Array.from(this.studentMap.keys());
    return (res.documents as any[]).filter(d =>
      internIds.includes(d.student_id) && (d.date === iso || d.date === pretty)
    );
  }

  // ── E-sig reminder ─────────────────────────────────────────
  private async checkEsigReminder(): Promise<void> {
    if (sessionStorage.getItem('esigReminderShown')) return;
    try {
      if (!this.currentSupervisorId) return; // guard — no ID means getCurrentSupervisor failed

      const doc = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL,
        this.currentSupervisorId
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
      // sessionStorage first, localStorage as fallback
      const storedId   = sessionStorage.getItem('currentDocId') || localStorage.getItem('currentDocId');
      const storedRole = sessionStorage.getItem('role')         || localStorage.getItem('role');

      if (!storedId || storedRole !== 'supervisor') {
        console.warn('[Dashboard] No supervisor id/role in storage:', { storedId, storedRole });
        return;
      }

      this.currentSupervisorId = storedId;
      const doc = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL,
        storedId
      );
      this.supervisorFirstName = (doc as any).first_name || '';
      this.supervisorName = `${(doc as any).first_name} ${(doc as any).last_name}`;
    } catch (error: any) {
      console.error('Failed to get supervisor:', error.message);
    }
  }

  // ── Load assigned students ────────────────────────────────
  async loadAssignedStudents() {
    this.studentsLoading = true;
    try {
      // fetch ALL students (default Appwrite limit is only 25)
      const allStudents = await this.fetchAll(this.appwrite.STUDENTS_COL);

      const assigned = allStudents.filter(
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

      // Build progress list — sorted by latest ($createdAt desc), max 3
      this.internProgress = [...assigned]
        .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())
        .slice(0, 3)
        .map(s => ({
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
      const allTasks = await this.fetchAll(this.appwrite.TASKS_COL);

      const internIds = Array.from(this.studentMap.keys());
      const myTasks = allTasks.filter(task => {
        if (!task.assigned_intern_ids) return false;
        const ids = task.assigned_intern_ids.split(',').map((id: string) => id.trim());
        return ids.some((id: string) => internIds.includes(id));
      });

      this.totalTasks     = myTasks.length;
      this.completedTasks = myTasks.filter(t => t.status === 'completed').length;
      this.pendingTasks   = myTasks.filter(t => t.status === 'pending').length;
    } catch (error: any) {
      console.error('Failed to load task stats:', error.message);
    }
  }

  // ── Today's stats ─────────────────────────────────────────
  async loadTodayStats() {
    try {
      const now = new Date();
      const todayRecords = await this.getTodayAttendanceDocs();

      const isWeekend   = now.getDay() === 0 || now.getDay() === 6;
      this.presentToday = todayRecords.filter(d => d.status === 'Present').length;
      this.absentToday  = isWeekend ? 0 : Math.max(this.totalInterns - this.presentToday, 0);
    } catch (error: any) {
      console.error('Failed to load today stats:', error.message);
    }
  }

  // ── Recent attendance — TODAY only, latest first, max 3 ───
  async loadRecentAttendance() {
    this.attendanceLoading = true;
    try {
      const todayDocs = await this.getTodayAttendanceDocs();

      this.recentAttendance = todayDocs.slice(0, 3).map(doc => {
        const student = this.studentMap.get(doc.student_id);
        return {
          intern_name:      student ? this.buildFullName(student.first_name, student.middle_name, student.last_name) : 'Unknown',
          profile_photo_id: student?.profile_photo_id,
          student_id:       doc.student_id,
          date:             this.formatDate(doc.date),
          time_in:          doc.time_in  || '—',
          time_out:         doc.time_out || '—',
          status:           doc.status   || 'Absent',
          hours_rendered:   this.calcHours(doc.time_in, doc.time_out),
        };
      });

    } catch (error: any) {
      console.error('Failed to load attendance:', error.message);
    } finally {
      this.attendanceLoading = false;
    }
  }


  // ── Recent tasks — latest first, max 3, truncated names ──
  async loadRecentTasks() {
    this.tasksLoading = true;
    try {
      const allTasks  = await this.fetchAll(this.appwrite.TASKS_COL);
      const internIds = Array.from(this.studentMap.keys());

      const myTasks = allTasks.filter(task => {
        if (!task.assigned_intern_ids) return false;
        const ids = task.assigned_intern_ids.split(',').map((id: string) => id.trim());
        return ids.some((id: string) => internIds.includes(id));
      });

      this.recentTasks = myTasks
        .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())
        .slice(0, 3)
        .map(task => {
          const ids = (task.assigned_intern_ids || '').split(',').map((id: string) => id.trim());
          const allNames = ids
            .map((id: string) => this.studentMap.get(id))
            .filter(Boolean)
            .map((s: any) => s.first_name);

          // Show first 2 first names, append "+N" if there are more
          let assignedNames = '';
          if (allNames.length === 0) {
            assignedNames = '—';
          } else if (allNames.length <= 2) {
            assignedNames = allNames.join(', ');
          } else {
            const remainder = allNames.length - 2;
            assignedNames = `${allNames[0]}, ${allNames[1]} +${remainder}`;
          }

          return {
            $id:           task.$id,
            title:         task.title       || '—',
            description:   task.description || '—',
            posted:        this.formatDate(task.$createdAt.split('T')[0]),
            due:           task.due ? this.formatDate(task.due) : '—',
            status:        task.status      || 'pending',
            assignedNames,
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
    // Already a readable date (e.g. "October 20, 2026") — leave as is
    if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
    try {
      const parts = dateStr.split('T')[0].split('-');
      const d     = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateStr; }
  }

  getAvatarUrl(record: AttendanceRecord): string {
    if (record.profile_photo_id && !record.photoFailed) {
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${record.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    }
    const initials = record.intern_name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('');
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