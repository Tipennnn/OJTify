import { Component, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import { Chart } from 'chart.js/auto';
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
export class AdminDashboardComponent implements OnInit, AfterViewInit {

  totalInterns      = 0;
  pendingApplicants = 0;

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadCounts();

    if (sessionStorage.getItem('adminWelcomeShown')) return;

    try {
      const user = await this.appwrite.account.get();

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
      // No active session, auth guard will handle redirect
    }
  }

  async loadCounts() {
    try {
      // Total interns — count students table
      const studentsRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      this.totalInterns = studentsRes.total;

      // Pending applicants — filter applicants by status
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
    const ctx = document.getElementById('attendanceChart') as HTMLCanvasElement;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        datasets: [
          {
            label: 'Present',
            data: [30, 50, 48, 45, 42, 47, 50],
            backgroundColor: '#3b82f6',
            borderRadius: 6
          },
          {
            label: 'Absent',
            data: [20, 5, 7, 10, 8, 3, 5],
            backgroundColor: '#f87171',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}