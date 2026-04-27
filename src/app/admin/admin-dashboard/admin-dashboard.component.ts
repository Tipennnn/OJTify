import { Component, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import Chart from 'chart.js/auto';
import Swal from 'sweetalert2';
import { Query } from 'appwrite';

interface AttendanceRow {
  intern_name   : string;
  school        : string;
  date          : string;
  time_in       : string;
  time_out      : string;
  hours         : string;
  status        : string;
  scanned_by_name: string;
  avatarUrl     : string;
}

interface InternRow {
  $id             : string;
  fullName        : string;
  completed_hours : number;
  required_hours  : number;
  avatarUrl       : string;
}

interface TaskRow {
  title          : string;
  supervisor_name: string;
  due            : string;
  status         : string;
}

interface HoursTier {
  label: string;
  count: number;
  color: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminSidenavComponent, AdminTopnavComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  isCollapsed = false;

  // ── Stat cards ────────────────────────────────────────────
  totalInterns      = 0;
  totalSupervisors  = 0;
  totalTasks        = 0;
  pendingApplicants = 0;
  approvedCount     = 0;
  declinedCount     = 0;
  presentToday      = 0;
  absentToday       = 0;

  // ── Chart data ────────────────────────────────────────────
  weeklyPresent : number[] = [0,0,0,0,0,0,0];
  weeklyAbsent  : number[] = [0,0,0,0,0,0,0];
  onTimeCount   = 0;
  lateCount     = 0;
  taskCompleted = 0;
  taskPending   = 0;

  // ── Table data ────────────────────────────────────────────
  recentAttendance  : AttendanceRow[] = [];
  attendanceLoading = false;
  topInterns        : InternRow[]     = [];
  recentTasks       : TaskRow[]       = [];
  hoursTiers        : HoursTier[]     = [];

  // ── Student map ───────────────────────────────────────────
  private studentMap: Map<string, any> = new Map();

  // ── Charts ────────────────────────────────────────────────
  attendanceChart: any;
  applicantsChart: any;
  timeChart      : any;
  taskChart      : any;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

  onToggleSidebar(state: boolean) { this.isCollapsed = state; }

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

  async ngOnInit() {
    await this.loadAllData();

    if (!sessionStorage.getItem('adminWelcomeShown')) {
      try {
        await this.appwrite.account.get();
        sessionStorage.setItem('adminWelcomeShown', 'true');
        Swal.fire({
          icon: 'success',
          title: 'Welcome back, Admin!',
          text: 'You are logged in as an administrator.',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
      } catch {}
    }
  }

 async loadAllData() {
  await this.loadStudents(); // must finish first so totalInterns is set
  await Promise.all([
    this.loadCounts(),
    this.loadAttendanceData(),
    this.loadTasks(),
    this.loadSupervisors(),
  ]);
  this.loadRecentAttendance();
}

  // ── Load students ─────────────────────────────────────────
 async loadStudents() {
  try {
    const res  = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL,
      [Query.limit(500)]
    );
    const docs = res.documents as any[];
    this.totalInterns = docs.length;
 
    this.studentMap.clear();
    docs.forEach(s => {
      this.studentMap.set(s.$id, s);
      if (s.student_id && s.student_id !== s.$id) {
        this.studentMap.set(s.student_id, s);
      }
      if (s.email) {
        this.studentMap.set(s.email, s);
      }
    });
 
    this.topInterns = [...docs]
      .sort((a, b) => (b.completed_hours || 0) - (a.completed_hours || 0))
      .slice(0, 5)
      .map(s => ({
        $id            : s.$id,
        fullName       : `${s.first_name} ${s.last_name}`,
        completed_hours: s.completed_hours || 0,
        required_hours : s.required_hours  || 500,
        avatarUrl      : this.getStudentAvatar(s),
      }));
 
    const tiers = [
      { label: '0–25%',  min: 0,    max: 0.25, color: '#ef4444', count: 0 },
      { label: '25–50%', min: 0.25, max: 0.5,  color: '#f97316', count: 0 },
      { label: '50–75%', min: 0.5,  max: 0.75, color: '#f59e0b', count: 0 },
      { label: '75–99%', min: 0.75, max: 1,    color: '#3b82f6', count: 0 },
      { label: '100%',   min: 1,    max: 999,  color: '#16a34a', count: 0 },
    ];
    docs.forEach(s => {
      const req  = s.required_hours  || 500;
      const done = s.completed_hours || 0;
      const pct  = done / req;
      for (const tier of tiers) {
        if (pct >= tier.min && pct < tier.max) { tier.count++; break; }
      }
    });
    this.hoursTiers = tiers;
 
  } catch (e: any) { console.error('loadStudents:', e.message); }
}
 
  // ── Load supervisors count ────────────────────────────────
async loadSupervisors() {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.SUPERVISORS_COL,
      [Query.limit(500)]
    );
    this.totalSupervisors = res.total;
  } catch {}
}

  // ── Load applicant counts ─────────────────────────────────
async loadCounts() {
  try {
    const res  = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.APPLICANTS_COL,
      [Query.limit(500)]
    );
    const docs = res.documents as any[];
    this.pendingApplicants = docs.filter(a => a.status === 'pending').length;
    this.approvedCount     = docs.filter(a => a.status === 'approved').length;
    this.declinedCount     = docs.filter(a => a.status === 'declined').length;
  } catch (e: any) { console.error('loadCounts:', e.message); }
}
  // ── Load tasks ────────────────────────────────────────────
  async loadTasks() {
  try {
    const res  = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.TASKS_COL,
      [Query.limit(500)]
    );
    const docs = res.documents as any[];
    this.totalTasks    = docs.length;
    this.taskCompleted = docs.filter(t => t.status === 'completed').length;
    this.taskPending   = docs.filter(t => t.status === 'pending').length;
 
    this.recentTasks = [...docs]
      .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())
      .slice(0, 5)
      .map(t => ({
        title          : t.title           || '—',
        supervisor_name: t.supervisor_name || '—',
        due            : t.due_date ? this.formatDate(t.due_date.split('T')[0]) : '—',
        status         : t.status          || 'pending',
      }));
  } catch (e: any) { console.error('loadTasks:', e.message); }
}
 

  // ── Load attendance data (charts + today stats) ───────────
  async loadAttendanceData() {
  try {
    const now   = new Date();
    const today = this.toDateStr(now);
 
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL,
      [Query.limit(500)]
    );
    const all = res.documents as any[];
 
    // Debug — remove once confirmed working
    console.log('Total attendance records fetched:', all.length);
    console.log('Looking for today:', today);
    console.log('Sample dates in DB:', all.slice(0, 5).map(a => a.date));
 
    const todayRecs   = all.filter(a => a.date === today);
    console.log('Today records found:', todayRecs.length);
 
    this.presentToday = todayRecs.filter(a => a.status === 'Present').length;
    const isWeekend   = now.getDay() === 0 || now.getDay() === 6;
    this.absentToday  = isWeekend ? 0 : Math.max(this.totalInterns - this.presentToday, 0);
 
    // Weekly
    this.weeklyPresent = [0,0,0,0,0,0,0];
    this.weeklyAbsent  = [0,0,0,0,0,0,0];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds  = this.toDateStr(d);
      const idx = 6 - i;
      const recs = all.filter(a => a.date === ds);
      this.weeklyPresent[idx] = recs.filter(a => a.status === 'Present').length;
      this.weeklyAbsent[idx]  = Math.max(this.totalInterns - this.weeklyPresent[idx], 0);
    }
 
    // On-time vs late
    this.onTimeCount = 0; this.lateCount = 0;
    todayRecs.forEach(r => {
      if (!r.time_in) return;
      try {
        const [time, period] = r.time_in.trim().split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h  = 0;
        const mins = h * 60 + m;
        if (mins >= 480 && mins <= 495) this.onTimeCount++;
        else if (mins > 495)            this.lateCount++;
      } catch {}
    });
 
  } catch (e: any) { console.error('loadAttendanceData:', e.message); }
}

  // ── Load recent attendance table (last 8 rows) ────────────
 async loadRecentAttendance() {
  this.attendanceLoading = true;
  try {
    const res  = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.ATTENDANCE_COL,
      [Query.limit(500)]
    );
    const docs = (res.documents as any[])
      .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime());
 
    this.recentAttendance = docs
      .map(r => {
        const student = this.studentMap.get(r.student_id);
        if (!student) return null; // skip unmatched
        return {
          intern_name    : `${student.first_name} ${student.last_name}`,
          school         : student?.school_name || '—',
          date           : this.formatDate(r.date),
          time_in        : r.time_in  || '—',
          time_out       : r.time_out || '—',
          hours          : this.calcHours(r.time_in, r.time_out),
          status         : r.status   || 'Absent',
          scanned_by_name: r.scanned_by_name || '—',
          avatarUrl      : this.getStudentAvatar(student),
        };
      })
      .filter(r => r !== null)
      .slice(0, 8) as AttendanceRow[]; // slice AFTER filtering so you always get 8 valid rows
 
  } catch (e: any) { console.error('loadRecentAttendance:', e.message); }
  finally { this.attendanceLoading = false; }
}
 
 

  // ── Chart helpers ─────────────────────────────────────────
  getPercent(done: number, req: number): number {
    if (!req) return 0;
    return Math.min(parseFloat(((done / req) * 100).toFixed(1)), 100);
  }

  getTierPercent(count: number): number {
    if (!this.totalInterns) return 0;
    return Math.round((count / this.totalInterns) * 100);
  }

  isOverdue(due: string, status: string): boolean {
    if (status === 'completed' || !due || due === '—') return false;
    try { return new Date(due) < new Date(); } catch { return false; }
  }

  // ── Misc helpers ──────────────────────────────────────────
  toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr || dateStr === '—') return '—';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch { return dateStr; }
  }

  calcHours(timeIn: string, timeOut: string): string {
    if (!timeIn || !timeOut || timeIn === '—' || timeOut === '—') return '—';
    try {
      const parseTime = (t: string): number => {
        t = t.trim();
        const parts = t.split(' ');
        const timePart = parts[0];
        const period   = parts[1]?.toUpperCase();
        let [h, m]     = timePart.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return -1;
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h  = 0;
        return h * 60 + m;
      };
      const inMins  = parseTime(timeIn);
      const outMins = parseTime(timeOut);
      if (inMins < 0 || outMins < 0) return '—';
      const diff = outMins - inMins;
      if (diff <= 0) return '—';
      const hrs = Math.floor(diff / 60);
      const min = diff % 60;
      return min > 0 ? `${hrs}h ${min}m` : `${hrs}h`;
    } catch { return '—'; }
  }

  getStudentAvatar(s: any): string {
    if (s?.profile_photo_id) {
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${s.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    }
    const name = s ? `${s.first_name || '?'} ${s.last_name || ''}` : '?';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=64`;
  }

  getFallbackAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=64`;
  }

  // ── Charts ────────────────────────────────────────────────
  ngAfterViewInit(): void { setTimeout(() => this.loadCharts(), 300); }

  loadCharts() {
    const weekLabels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      weekLabels.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    }

    // ── ATTENDANCE BAR CHART ──────────────────────────────
    const attCtx = (document.getElementById('attendanceChart') as HTMLCanvasElement)?.getContext('2d');
    if (attCtx) {
      if (this.attendanceChart) this.attendanceChart.destroy();
      this.attendanceChart = new Chart(attCtx, {
        type: 'bar',
        data: {
          labels: weekLabels,
          datasets: [
            {
              label: 'Present',
              data: this.weeklyPresent,
              backgroundColor: '#2563eb',
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 22,
            },
            {
              label: 'Absent',
              data: this.weeklyAbsent,
              backgroundColor: '#e5e7eb',
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 22,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#111827',
              titleColor: '#fff',
              bodyColor: '#d1d5db',
              padding: 10,
              cornerRadius: 8,
            }
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: '#9ca3af', font: { size: 11 } }
            },
            y: {
              grid: { color: '#f3f4f6' },
              border: { display: false },
              ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1 },
              beginAtZero: true
            }
          }
        }
      });
    }

    // ── APPLICANTS DONUT ──────────────────────────────────
    const appCtx = (document.getElementById('applicantsChart') as HTMLCanvasElement)?.getContext('2d');
    if (appCtx) {
      if (this.applicantsChart) this.applicantsChart.destroy();
      this.applicantsChart = new Chart(appCtx, {
        type: 'doughnut',
        data: {
          labels: ['Approved', 'Declined', 'Pending'],
          datasets: [{
            data: [this.approvedCount, this.declinedCount, this.pendingApplicants],
            backgroundColor: ['#16a34a', '#dc2626', '#f59e0b'],
            borderWidth: 0,
            hoverOffset: 12,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                pointStyleWidth: 8,
                padding: 16,
                color: '#374151',
                font: { size: 12 }
              }
            },
            tooltip: {
              backgroundColor: '#111827',
              titleColor: '#fff',
              bodyColor: '#d1d5db',
              padding: 10,
              cornerRadius: 8,
            }
          }
        }
      });
    }

    // ── TIME-IN HORIZONTAL BAR ────────────────────────────
    const timeCtx = (document.getElementById('timeChart') as HTMLCanvasElement)?.getContext('2d');
    if (timeCtx) {
      if (this.timeChart) this.timeChart.destroy();
      this.timeChart = new Chart(timeCtx, {
        type: 'bar',
        data: {
          labels: ['On-Time', 'Late', 'Absent'],
          datasets: [{
            label: 'Interns',
            data: [this.onTimeCount, this.lateCount, this.absentToday],
            backgroundColor: ['#2563eb', '#f97316', '#e5e7eb'],
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 28,
          }]
        },
        options: {
          indexAxis: 'y' as const,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#111827',
              titleColor: '#fff',
              bodyColor: '#d1d5db',
              padding: 10,
              cornerRadius: 8,
            }
          },
          scales: {
            x: {
              grid: { color: '#f3f4f6' },
              border: { display: false },
              ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1 },
              beginAtZero: true
            },
            y: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: '#374151', font: { size: 12, weight: 500 } }
            }
          }
        }
      });
    }

    // ── TASK DONUT ────────────────────────────────────────
    const taskCtx = (document.getElementById('taskChart') as HTMLCanvasElement)?.getContext('2d');
    if (taskCtx) {
      if (this.taskChart) this.taskChart.destroy();
      this.taskChart = new Chart(taskCtx, {
        type: 'doughnut',
        data: {
          labels: ['Completed', 'Pending'],
          datasets: [{
            data: [this.taskCompleted, this.taskPending],
            backgroundColor: ['#2563eb', '#e5e7eb'],
            borderWidth: 0,
            hoverOffset: 12,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                pointStyleWidth: 8,
                padding: 16,
                color: '#374151',
                font: { size: 12 }
              }
            },
            tooltip: {
              backgroundColor: '#111827',
              titleColor: '#fff',
              bodyColor: '#d1d5db',
              padding: 10,
              cornerRadius: 8,
            }
          }
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.attendanceChart?.destroy();
    this.applicantsChart?.destroy();
    this.timeChart?.destroy();
    this.taskChart?.destroy();
  }
}