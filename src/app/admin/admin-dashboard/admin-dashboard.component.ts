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

  totalInterns      = 0;
  pendingApplicants = 0;
  attendanceChart: any;

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadCounts();

    if (sessionStorage.getItem('adminWelcomeShown')) return;

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
    } catch {
      // handled by auth guard
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
      this.pendingApplicants = (applicantsRes.documents as any[])
        .filter(a => a.status === 'pending').length;

    } catch (error: any) {
      console.error('Failed to load counts:', error.message);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.loadChart();
    }, 100);
  }

  loadChart() {
    const canvas = document.getElementById('attendanceChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.attendanceChart) {
      this.attendanceChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 💎 PREMIUM GRADIENTS
    const blueGradient = ctx.createLinearGradient(0, 0, 0, 300);
    blueGradient.addColorStop(0, '#2563eb'); // deep blue
    blueGradient.addColorStop(1, '#60a5fa'); // soft blue

    const grayGradient = ctx.createLinearGradient(0, 0, 0, 300);
    grayGradient.addColorStop(0, '#e5e7eb'); // light gray
    grayGradient.addColorStop(1, '#cbd5f5'); // soft neutral

    this.attendanceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        datasets: [
          {
            label: 'Present',
            data: [30, 50, 48, 45, 42, 47, 50],
            backgroundColor: blueGradient,
            borderRadius: 12,
            barThickness: 26
          },
          {
            label: 'Absent',
            data: [20, 5, 7, 10, 8, 3, 5],
            backgroundColor: grayGradient,
            borderRadius: 12,
            barThickness: 26
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,

        animation: {
          duration: 1400,
          easing: 'easeOutQuart'
        },

        layout: {
          padding: {
            top: 10,
            bottom: 5
          }
        },

        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#374151',
              font: {
                size: 13,
                weight: 500 // ✅ number, not string
              },
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },

          tooltip: {
            backgroundColor: '#111827',
            titleColor: '#fff',
            bodyColor: '#e5e7eb',
            padding: 12,
            cornerRadius: 10,
            displayColors: false
          }
        },

        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#6b7280',
              font: {
                size: 12,
                weight: 500
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            },
            ticks: {
              color: '#6b7280',
              stepSize: 10,
              font: {
                size: 12,
                weight: 500
              }
            }
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.attendanceChart) {
      this.attendanceChart.destroy();
    }
  }
}