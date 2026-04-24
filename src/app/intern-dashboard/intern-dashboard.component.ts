import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
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
  date: string;
  time_in: string;
  time_out: string;
  status: string;
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
    await this.checkAndShowAlerts();
  }

  async getCurrentUser() {
    try {
      const user         = await this.appwrite.account.get();
      this.currentUserId = user.$id;
    } catch { }
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

      const now   = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL
      );
      const todayRecord = (res.documents as any[])
        .find(d => d.student_id === this.currentUserId && d.date === today);

      if (todayRecord) {
        this.todayStatus = todayRecord.status;
      } else {
        const createdAt = (doc as any).$createdAt;
        const startDate = new Date(createdAt);
        startDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        this.todayStatus = startDate < now ? 'Absent' : 'No Record Yet';
      }

    } catch (error: any) {
      console.error('Failed to load student data:', error.message);
    }
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
        .slice(0, 3); // 3 most recent records only

      this.recentAttendance = myRecords.map(record => ({
        date    : this.formatDate(record.date),   // "April 21, 2026"
        time_in : record.time_in  || '—',
        time_out: record.time_out || '—',
        status  : record.status
      }));

    } catch (error: any) {
      console.error('Failed to load attendance:', error.message);
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

  // ── Format date helper — "April 21, 2026" ────────────────
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

    // ← ADD THIS: Profile photo reminder (every login, only if no photo)
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
  // ── Load recent tasks (3 latest, columns: Task / Date Assigned / Due Date / Status) ──
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
        .slice(0, 3)  // 3 most recent tasks only
        .map(task => ({
          $id        : task.$id,
          title      : task.title       || '—',
          description: task.description || '—',
          posted     : this.formatDate(task.$createdAt.split('T')[0]),
          due        : task.due_date    ? this.formatDate(task.due_date.split('T')[0]) : '—',
          status     : task.status      || 'pending'
        }));

    } catch (error: any) {
      console.error('Failed to load tasks:', error.message);
    } finally {
      this.tasksLoading = false;
    }
  }
}