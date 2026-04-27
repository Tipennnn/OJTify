import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
import Swal from 'sweetalert2';
import { Query } from 'appwrite';

interface Task {
  $id?: string;
  title: string;
  description: string;
  posted: string;
  due: string;
  status: 'completed' | 'pending';
  supervisor_name?: string;
}

interface AttendanceRecord {
  date: string;
  time_in: string;
  time_out: string;
  status: string;
  hours_rendered?: string;
}

@Component({
  selector: 'app-intern-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, InternSidenavComponent, InternTopnavComponent],
  templateUrl: './intern-dashboard.component.html',
  styleUrls: ['./intern-dashboard.component.css']
})
export class InternDashboardComponent implements OnInit {

  recentTasks       : Task[] = [];
  tasksLoading      = false;
  currentUserId     = '';
  profileIncomplete = false;
  firstName         = '';

  // ── Hours & attendance ────────────────────────────────────
  requiredHours  = 500;
  completedHours = 0;
  todayStatus    = 'Absent';

  // ── Recent attendance ─────────────────────────────────────
  recentAttendance : AttendanceRecord[] = [];
  internStartDate  : Date | null = null;

  // ── Application info ──────────────────────────────────────
  appliedOn  = '—';
  acceptedOn = '—';
  appStatus  = '—';

  // ── Supervisor info ───────────────────────────────────────
  supervisorName     = '';
  supervisorEmail    = '';
  supervisorInitial  = '?';
  supervisorPhotoUrl = '';

  // ── Quick stats ───────────────────────────────────────────
  totalTasks     = 0;
  completedTasks = 0;
  pendingTasks   = 0;
  totalPresent   = 0;
  totalAbsent    = 0;

  constructor(
    private appwrite: AppwriteService,
    private router  : Router
  ) {}

  async ngOnInit() {
    await this.getCurrentUser();
    this.loadRecentTasks();
    this.loadStudentData();
    this.loadRecentAttendance();
    this.loadApplicationInfo();
    this.loadAllTaskStats();
    this.loadAllAttendanceStats();
    await this.checkAndShowAlerts();
  }

  async getCurrentUser() {
    try {
      const user         = await this.appwrite.account.get();
      this.currentUserId = user.$id;
      this.firstName     = user.name?.split(' ')[0] || user.email || 'Student';
    } catch { }
  }

  // ── Greeting by time of day ───────────────────────────────
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

  get todayDateShort(): string {
    return new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  // ── SVG progress ring ─────────────────────────────────────
  // circumference = 2 * π * 32 ≈ 201.06
  readonly CIRCUMFERENCE = 2 * Math.PI * 32;

  get ringDashOffset(): number {
    const pct = Math.min(this.hoursProgress / 100, 1);
    return this.CIRCUMFERENCE * (1 - pct);
  }

  // ── Estimated days remaining ──────────────────────────────
  get daysRemaining(): number {
    if (this.completedHours === 0) return this.requiredHours;
    const remaining = this.requiredHours - this.completedHours;
    if (remaining <= 0) return 0;
    // Estimate based on avg 8hrs/day
    return Math.ceil(remaining / 8);
  }

  // ── Load student hours + today attendance ─────────────────
 async loadStudentData() {
  try {
    const doc = await this.appwrite.databases.getDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL,
      this.currentUserId
    );
    this.requiredHours  = (doc as any).required_hours  || 500;
    this.completedHours = (doc as any).completed_hours || 0;

    const start = new Date((doc as any).$createdAt);
    start.setHours(0, 0, 0, 0);
    this.internStartDate = start;

    // Load supervisor info
    const supervisorId = (doc as any).supervisor_id;
    if (supervisorId) {
      this.loadSupervisorInfo(supervisorId);
    }

    // ── FIX: build today string ONCE and reuse ────────────
    const now   = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // ── FIX: query with filters instead of fetching all ───
    const { Query } = await import('appwrite');
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.ATTENDANCE_COL,
      [
        Query.equal('student_id', this.currentUserId),
        Query.equal('date', today)
      ]
    );

    if (res.documents.length > 0) {
      this.todayStatus = (res.documents[0] as any).status;
    } else {
      const startDate = new Date((doc as any).$createdAt);
      startDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      this.todayStatus = startDate < now ? 'Absent' : 'No Record Yet';
    }

  } catch (error: any) {
    console.error('Failed to load student data:', error.message);
  }
}

  // ── Load supervisor info ──────────────────────────────────
  async loadSupervisorInfo(supervisorId: string) {
    try {
      const doc = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL || 'supervisors',
        supervisorId
      );
      const s = doc as any;
      const firstName = s.first_name || '';
      const lastName  = s.last_name  || '';
      this.supervisorName    = `${firstName} ${lastName}`.trim() || s.name || '—';
      this.supervisorEmail   = s.email || '';
      this.supervisorInitial = this.supervisorName.charAt(0).toUpperCase() || '?';

      if (s.profile_photo_id?.trim()) {
        // Use direct URL construction — avoids all SDK type issues
        this.supervisorPhotoUrl = this.appwrite.getFileViewUrl(s.profile_photo_id.trim());
        console.log('Supervisor photo URL:', this.supervisorPhotoUrl);
      }
    } catch (error: any) {
      console.error('Failed to load supervisor info:', error.message);
    }
  }

  // ── Load all task stats (totals) ──────────────────────────
  async loadAllTaskStats() {
    try {
      const res      = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL
      );
      const allTasks = (res.documents as any[]).filter(task => {
        if (!task.assigned_intern_ids) return false;
        return task.assigned_intern_ids
          .split(',').map((id: string) => id.trim())
          .includes(this.currentUserId);
      });
      this.totalTasks     = allTasks.length;
      this.completedTasks = allTasks.filter(t => t.status === 'completed').length;
      this.pendingTasks   = allTasks.filter(t => t.status === 'pending').length;
    } catch { }
  }

  // ── Load all attendance stats ──────────────────────────────
  async loadAllAttendanceStats() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );
      const mine = (res.documents as any[]).filter(d => d.student_id === this.currentUserId);
      this.totalPresent = mine.filter(d => d.status === 'Present').length;
      this.totalAbsent  = mine.filter(d => d.status === 'Absent').length;
    } catch { }
  }

  // ── Load recent attendance (last 3 records) ───────────────
  async loadRecentAttendance() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );

      const myRecords = (res.documents as any[])
        .filter(d => d.student_id === this.currentUserId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);

      this.recentAttendance = myRecords.map(record => {
        const hoursRendered = this.calcHours(record.time_in, record.time_out);
        return {
          date         : this.formatDate(record.date),
          time_in      : record.time_in  || '—',
          time_out     : record.time_out || '—',
          status       : record.status,
          hours_rendered: hoursRendered
        };
      });

    } catch (error: any) {
      console.error('Failed to load attendance:', error.message);
    }
  }

  // ── Calculate hours between time_in and time_out ──────────
  calcHours(timeIn: string, timeOut: string): string {
    if (!timeIn || !timeOut || timeIn === '—' || timeOut === '—') return '—';
    try {
      const parse = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      const diff = parse(timeOut) - parse(timeIn);
      if (diff <= 0) return '—';
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    } catch {
      return '—';
    }
  }

  // ── Check if a task is overdue ────────────────────────────
  isOverdue(dueDateStr: string, status: string): boolean {
    if (status === 'completed' || !dueDateStr || dueDateStr === '—') return false;
    try {
      const parts = dueDateStr.split(' ');
      // dueDateStr is formatted like "April 21, 2026"
      const d = new Date(dueDateStr);
      return d < new Date();
    } catch {
      return false;
    }
  }

  // ── Load application info ─────────────────────────────────
  async loadApplicationInfo() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.APPLICANTS_COL
      );

      const applicant = (res.documents as any[])
        .find(a => a.auth_user_id === this.currentUserId || a.$id === this.currentUserId);

      if (applicant) {
        this.appliedOn = this.formatDate(applicant.$createdAt.split('T')[0]);
        this.appStatus = applicant.status === 'approved' ? 'Accepted'
                       : applicant.status === 'declined' ? 'Declined'
                       : 'Pending';
      } else {
        this.appliedOn = '—';
        this.appStatus = 'Accepted';
      }

      try {
        const studentDoc = await this.appwrite.databases.getDocument(
          this.appwrite.DATABASE_ID,
          this.appwrite.STUDENTS_COL,
          this.currentUserId
        );
        this.acceptedOn = this.formatDate((studentDoc as any).$createdAt.split('T')[0]);
      } catch { }

    } catch (error: any) {
      console.error('Failed to load application info:', error.message);
    }
  }

  // ── Format date helper ─────────────────────────────────────
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

  get hoursProgress(): number {
    if (this.requiredHours === 0) return 0;
    return Math.min(parseFloat(((this.completedHours / this.requiredHours) * 100).toFixed(1)), 100);
  }

  get remainingHours(): number {
    return Math.max(this.requiredHours - this.completedHours, 0);
  }

  async checkAndShowAlerts() {
    try {
      const user      = await this.appwrite.account.get();
      const firstName = user.name?.split(' ')[0] || user.email || 'Student';

      const res  = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      const docs = res.documents as any[];
      const doc  = docs.find(d => d.$id === this.currentUserId);

      const missingFields: string[] = [];
      if (doc) {
        if (!doc.profile_photo_id?.trim()) missingFields.push('Profile photo');
        if (!doc.contact_number?.trim())   missingFields.push('Contact number');
        if (!doc.home_address?.trim())     missingFields.push('Home address');
      }

      this.profileIncomplete = missingFields.length > 0;

      if (!sessionStorage.getItem('welcomeShown')) {
        sessionStorage.setItem('welcomeShown', 'true');
        await Swal.fire({
          icon: 'success',
          title: `Welcome back, ${firstName}!`,
          text: 'You have successfully logged in.',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
      }

      if (this.profileIncomplete && !sessionStorage.getItem('profileAlertShown')) {
        sessionStorage.setItem('profileAlertShown', 'true');
        const result = await Swal.fire({
          icon: 'warning',
          title: 'Profile Incomplete!',
          html: `Please complete the following in your profile:<br><br>
                 <b style="color:#d97706;">${missingFields.join(', ')}</b>`,
          showCancelButton: true,
          confirmButtonText: 'Complete Now',
          cancelButtonText: 'Later',
          confirmButtonColor: '#d97706',
          cancelButtonColor: '#6b7280',
        });
        if (result.isConfirmed) {
          this.router.navigate(['/intern-profile']);
        }
      }

      await this.checkProfilePhotoReminder(doc);

    } catch { }
  }

  private async checkProfilePhotoReminder(doc: any): Promise<void> {
    if (sessionStorage.getItem('profilePhotoReminderShown')) return;
    sessionStorage.setItem('profilePhotoReminderShown', 'true');

    const hasPhoto = !!doc?.profile_photo_id?.trim();
    if (hasPhoto) return;

    const result = await Swal.fire({
      icon: 'info',
      title: 'No Profile Photo',
      html: `
        <p style="font-size:14px; color:#374151; margin:0 0 8px;">
          You haven't uploaded a profile photo yet.
        </p>
        <p style="font-size:13px; color:#6b7280; margin:0;">
          A profile photo helps your supervisor identify you easily.
        </p>
      `,
      confirmButtonText: '<i class="fas fa-camera"></i>&nbsp; Upload Photo',
      confirmButtonColor: '#2563eb',
      showCancelButton: true,
      cancelButtonText: 'Remind me later',
      cancelButtonColor: '#6b7280',
      allowOutsideClick: false,
      focusConfirm: false,
    });

    if (result.isConfirmed) {
      this.router.navigate(['/intern-profile']);
    }
  }

  // ── Load recent tasks ─────────────────────────────────────
  async loadRecentTasks() {
    this.tasksLoading = true;
    try {
      const res      = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL
      );
      const allTasks = res.documents as any[];
      const myTasks  = allTasks.filter(task => {
        if (!task.assigned_intern_ids) return false;
        return task.assigned_intern_ids
          .split(',').map((id: string) => id.trim())
          .includes(this.currentUserId);
      });

      this.recentTasks = myTasks
        .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())
        .slice(0, 3)
        .map(task => ({
          $id            : task.$id,
          title          : task.title           || '—',
          description    : task.description     || '—',
          posted         : this.formatDate(task.$createdAt.split('T')[0]),
          due            : task.due ? this.formatDate(task.due) : '—',
          status         : task.status          || 'pending',
          supervisor_name: task.supervisor_name || '—'
        }));

    } catch (error: any) {
      console.error('Failed to load tasks:', error.message);
    } finally {
      this.tasksLoading = false;
    }
  }
}