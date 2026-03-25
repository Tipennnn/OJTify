import { Component, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import Chart from 'chart.js/auto';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AdminSidenavComponent,
    AdminTopnavComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  isCollapsed = false;

  // ── Stats ─────────────────────────────────────────────────
  totalInterns      = 0;
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

  // ── Charts ────────────────────────────────────────────────
  attendanceChart : any;
  applicantsChart : any;
  timeChart       : any;

  constructor(private appwrite: AppwriteService) {}

  onToggleSidebar(state: boolean) {
    this.isCollapsed = state;
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
    await Promise.all([
      this.loadCounts(),
      this.loadAttendanceData()
    ]);
  }

  async loadCounts() {
    try {
      const studentsRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      this.totalInterns = studentsRes.total;

      const applicantsRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.APPLICANTS_COL
      );
      const applicants = applicantsRes.documents as any[];

      this.pendingApplicants = applicants.filter(a => a.status === 'pending').length;
      this.approvedCount     = applicants.filter(a => a.status === 'approved').length;
      this.declinedCount     = applicants.filter(a => a.status === 'declined').length;

    } catch (error: any) {
      console.error('Failed to load counts:', error.message);
    }
  }

  async loadAttendanceData() {
  try {
    const now   = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    const attendRes = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.ATTENDANCE_COL
    );
    const allAttendance = attendRes.documents as any[];

    // ── Today present / absent ────────────────────────────
    const todayRecords = allAttendance.filter(a => a.date === today);
    this.presentToday  = todayRecords.filter(a => a.status === 'Present').length;
    this.absentToday   = this.totalInterns - this.presentToday;
    if (this.absentToday < 0) this.absentToday = 0;

    // ── Weekly attendance (last 7 days) ───────────────────
    this.weeklyPresent = [0,0,0,0,0,0,0];
    this.weeklyAbsent  = [0,0,0,0,0,0,0];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const dayIndex = 6 - i;

      const dayRecords = allAttendance.filter(a => a.date === dateStr);
      this.weeklyPresent[dayIndex] = dayRecords.filter(a => a.status === 'Present').length;
      this.weeklyAbsent[dayIndex]  = Math.max(this.totalInterns - this.weeklyPresent[dayIndex], 0);
    }

    // ── On-time vs late (today) ───────────────────────────
    this.onTimeCount = 0;
    this.lateCount   = 0;

    todayRecords.forEach(record => {
      if (!record.time_in || record.time_in === '') return;
      try {
        const [time, period] = record.time_in.trim().split(' ');
        let   [hours, mins]  = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours  = 0;

        const totalMins    = hours * 60 + mins;
        const onTimeStart  = 8 * 60;       // 8:00 AM
        const onTimeCutoff = 8 * 60 + 15;  // 8:15 AM

        if (totalMins >= onTimeStart && totalMins <= onTimeCutoff) {
          this.onTimeCount++;
        } else if (totalMins > onTimeCutoff) {
          this.lateCount++;
        }
        // before 8:00 AM = early, not counted as either

      } catch { }
    });

  } catch (error: any) {
    console.error('Failed to load attendance data:', error.message);
  }
}

  ngAfterViewInit(): void {
    setTimeout(() => this.loadCharts(), 200);
  }

  loadCharts() {
    const attendanceCtx = (document.getElementById('attendanceChart') as HTMLCanvasElement)?.getContext('2d');
    const applicantsCtx = (document.getElementById('applicantsChart') as HTMLCanvasElement)?.getContext('2d');
    const timeCtx       = (document.getElementById('timeChart')       as HTMLCanvasElement)?.getContext('2d');

    if (!attendanceCtx || !applicantsCtx || !timeCtx) return;

    // ── Weekly labels (last 7 days) ───────────────────────
    const weekLabels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weekLabels.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    }

    // ── ATTENDANCE CHART ──────────────────────────────────
    if (this.attendanceChart) this.attendanceChart.destroy();

    const presentGrad = attendanceCtx.createLinearGradient(0,0,0,300);
    presentGrad.addColorStop(0, '#3b82f6');
    presentGrad.addColorStop(1, '#60a5fa');

    const absentGrad = attendanceCtx.createLinearGradient(0,0,0,300);
    absentGrad.addColorStop(0, '#9ca3af');
    absentGrad.addColorStop(1, '#d1d5db');

    this.attendanceChart = new Chart(attendanceCtx, {
      type: 'bar',
      data: {
        labels: weekLabels,
        datasets: [
          {
            label: 'Present',
            data: this.weeklyPresent,
            backgroundColor: presentGrad,
            borderRadius: 10,
            barThickness: 20
          },
          {
            label: 'Absent',
            data: this.weeklyAbsent,
            backgroundColor: absentGrad,
            borderRadius: 10,
            barThickness: 20
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#374151', font: { size: 13, weight: 500 } }
          }
        },
        scales: {
          x: { grid: { color: '#e5e7eb' }, ticks: { color: '#6b7280', font: { size: 11 } } },
          y: {
            grid: { color: '#e5e7eb' },
            ticks: { color: '#6b7280', font: { size: 12 }, stepSize: 1 },
            beginAtZero: true
          }
        }
      }
    });

    // ── DONUT CHART ───────────────────────────────────────
    if (this.applicantsChart) this.applicantsChart.destroy();

    const total = this.approvedCount + this.declinedCount + this.pendingApplicants;

    const gradApproved = applicantsCtx.createLinearGradient(0,0,0,150);
    gradApproved.addColorStop(0, '#6ee7b7');
    gradApproved.addColorStop(1, '#10b981');

    const gradDeclined = applicantsCtx.createLinearGradient(0,0,0,150);
    gradDeclined.addColorStop(0, '#fca5a5');
    gradDeclined.addColorStop(1, '#ef4444');

    const gradPending = applicantsCtx.createLinearGradient(0,0,0,150);
    gradPending.addColorStop(0, '#fcd34d');
    gradPending.addColorStop(1, '#f59e0b');

    this.applicantsChart = new Chart(applicantsCtx, {
      type: 'doughnut',
      data: {
        labels: ['Approved', 'Declined', 'Pending'],
        datasets: [{
          data: [this.approvedCount, this.declinedCount, this.pendingApplicants],
          backgroundColor: [gradApproved, gradDeclined, gradPending],
          borderWidth: 0,
          hoverOffset: 15
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, padding: 10, color: '#374151', font: { size: 12 } }
          },
          tooltip: {
            backgroundColor: '#111827',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (context: any) => {
                const value   = context.raw;
                const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return `${context.label}: ${value} (${percent}%)`;
              }
            }
          }
        }
      }
    });

    // ── TIME-IN BEHAVIOR CHART ────────────────────────────
    if (this.timeChart) this.timeChart.destroy();

    const onTimeGrad = timeCtx.createLinearGradient(0,0,0,150);
    onTimeGrad.addColorStop(0, '#3b82f6');
    onTimeGrad.addColorStop(1, '#60a5fa');

    const lateGrad = timeCtx.createLinearGradient(0,0,0,150);
    lateGrad.addColorStop(0, '#f97316');
    lateGrad.addColorStop(1, '#fb923c');

    const absentGradTime = timeCtx.createLinearGradient(0,0,0,150);
    absentGradTime.addColorStop(0, '#9ca3af');
    absentGradTime.addColorStop(1, '#d1d5db');

    this.timeChart = new Chart(timeCtx, {
      type: 'bar',
      data: {
        labels: ['On-Time', 'Late', 'Absent'],
        datasets: [{
          label: 'Interns',
          data: [this.onTimeCount, this.lateCount, this.absentToday],
          backgroundColor: [onTimeGrad, lateGrad, absentGradTime],
          borderRadius: 10,
          barThickness: 20
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 8,
            cornerRadius: 6
          }
        },
        scales: {
          x: { grid: { color: '#e5e7eb' }, ticks: { color: '#6b7280', font: { size: 12 } } },
          y: {
            grid: { color: '#e5e7eb' },
            ticks: { color: '#6b7280', font: { size: 12 }, stepSize: 1 },
            beginAtZero: true
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.attendanceChart?.destroy();
    this.applicantsChart?.destroy();
    this.timeChart?.destroy();
  }
}