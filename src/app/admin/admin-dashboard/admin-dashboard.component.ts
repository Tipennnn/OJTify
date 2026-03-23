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
  imports: [CommonModule, RouterModule, AdminSidenavComponent, AdminTopnavComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  totalInterns = 0;
  pendingApplicants = 0;
  approvedCount = 0;
  declinedCount = 0;

  attendanceChart: any;
  applicantsChart: any;
  timeChart: any;

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadCounts();

    if (!sessionStorage.getItem('adminWelcomeShown')) {
      try {
        await this.appwrite.account.get();
        sessionStorage.setItem('adminWelcomeShown', 'true');
        Swal.fire({
          icon: 'success',
          title: `Welcome back, Admin!`,
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
      this.approvedCount = applicants.filter(a => a.status === 'approved').length;
      this.declinedCount = applicants.filter(a => a.status === 'declined').length;

    } catch (error: any) {
      console.error('Failed to load counts:', error.message);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.loadCharts(), 100);
  }

  loadCharts() {
    const attendanceCtx = (document.getElementById('attendanceChart') as HTMLCanvasElement)?.getContext('2d');
    const applicantsCtx = (document.getElementById('applicantsChart') as HTMLCanvasElement)?.getContext('2d');
    const timeCtx = (document.getElementById('timeChart') as HTMLCanvasElement)?.getContext('2d');

    if (!attendanceCtx || !applicantsCtx || !timeCtx) return;

    const blue = '#3b82f6';
    const gray = '#9ca3af';
    const green = '#22c55e';
    const orange = '#f97316';

    // Attendance Chart
    if (this.attendanceChart) this.attendanceChart.destroy();
    const presentGrad = attendanceCtx.createLinearGradient(0,0,0,300);
    presentGrad.addColorStop(0, '#3b82f6'); presentGrad.addColorStop(1, '#60a5fa');
    const absentGrad = attendanceCtx.createLinearGradient(0,0,0,300);
    absentGrad.addColorStop(0, '#9ca3af'); absentGrad.addColorStop(1, '#d1d5db');

    this.attendanceChart = new Chart(attendanceCtx, {
      type: 'bar',
      data: {
        labels: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
        datasets: [
          { label:'Present', data:[30,50,48,45,42,47,50], backgroundColor: presentGrad, borderRadius:10, barThickness:20 },
          { label:'Absent', data:[20,5,7,10,8,3,5], backgroundColor: absentGrad, borderRadius:10, barThickness:20 }
        ]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins: { legend:{ position:'top', labels:{ color:'#374151', font:{ size:13, weight:500 } } } },
        scales: {
          x: { grid:{ color:'#e5e7eb' }, ticks:{ color:'#6b7280', font:{ size:12 } } },
          y: { grid:{ color:'#e5e7eb' }, ticks:{ color:'#6b7280', font:{ size:12 }, stepSize:10 } }
        }
      }
    });

    // Donut Chart
    if (this.applicantsChart) this.applicantsChart.destroy();
    const total = this.approvedCount + this.declinedCount + this.pendingApplicants;

    const gradApproved = applicantsCtx.createLinearGradient(0,0,0,150);
    gradApproved.addColorStop(0, '#6ee7b7'); gradApproved.addColorStop(1,'#10b981');
    const gradDeclined = applicantsCtx.createLinearGradient(0,0,0,150);
    gradDeclined.addColorStop(0,'#fca5a5'); gradDeclined.addColorStop(1,'#ef4444');
    const gradPending = applicantsCtx.createLinearGradient(0,0,0,150);
    gradPending.addColorStop(0,'#fcd34d'); gradPending.addColorStop(1,'#f59e0b');

    this.applicantsChart = new Chart(applicantsCtx, {
      type:'doughnut',
      data:{
        labels:['Approved','Declined','Pending'],
        datasets:[{
          data:[this.approvedCount, this.declinedCount, this.pendingApplicants],
          backgroundColor:[gradApproved,gradDeclined,gradPending],
          borderWidth:0,
          hoverOffset:15
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        cutout:'70%',
        plugins:{
          legend:{ position:'bottom', labels:{ usePointStyle:true, pointStyle:'circle', padding:10, color:'#374151', font:{ size:12 } } },
          tooltip:{
            backgroundColor:'#111827',
            titleColor:'#fff',
            bodyColor:'#fff',
            padding:10,
            cornerRadius:6,
            callbacks:{
              label:(context:any)=>{
                const value = context.raw;
                const percent = total>0?((value/total)*100).toFixed(1):'0';
                return `${context.label}: ${value} (${percent}%)`;
              }
            }
          }
        }
      },
      plugins:[{
        id:'centerText',
        beforeDraw:(chart)=>{
          const {width,height,ctx} = chart;
          ctx.save();
          ctx.font = '700 24px Poppins';
          ctx.fillStyle='#111827';
          ctx.textAlign='center';
          ctx.textBaseline='middle';
          ctx.fillText(total.toString(),width/2,height/2-3);
          ctx.font='12px Poppins';
          ctx.fillStyle='#6b7280';
          ctx.fillText('Total',width/2,height/2+15);
          ctx.restore();
        }
      }]
    });

    // Time-In Chart
    if(this.timeChart) this.timeChart.destroy();
    const onTimeGrad = timeCtx.createLinearGradient(0,0,0,150); onTimeGrad.addColorStop(0,blue); onTimeGrad.addColorStop(1,'#60a5fa');
    const lateGrad = timeCtx.createLinearGradient(0,0,0,150); lateGrad.addColorStop(0,orange); lateGrad.addColorStop(1,'#fb923c');
    const absentGradTime = timeCtx.createLinearGradient(0,0,0,150); absentGradTime.addColorStop(0,gray); absentGradTime.addColorStop(1,'#d1d5db');

    this.timeChart = new Chart(timeCtx,{
      type:'bar',
      data:{
        labels:['On-Time','Late','Absent'],
        datasets:[{
          label:'Employees',
          data:[40,10,5],
          backgroundColor:[onTimeGrad,lateGrad,absentGradTime],
          borderRadius:10,
          barThickness:20
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{ display:false },
          tooltip:{ backgroundColor:'#111827', titleColor:'#fff', bodyColor:'#fff', padding:8, cornerRadius:6 }
        },
        scales:{
          x:{ grid:{ color:'#e5e7eb' }, ticks:{ color:'#6b7280', font:{ size:12 } } },
          y:{ grid:{ color:'#e5e7eb' }, ticks:{ color:'#6b7280', font:{ size:12 }, stepSize:10 } }
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