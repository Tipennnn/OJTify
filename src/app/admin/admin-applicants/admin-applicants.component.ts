import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';

interface Applicant {
  name: string;
  studentId: string;
  course: string;
  email: string;
  status: string;

  firstName?: string;
  middleName?: string;
  lastName?: string;
  contact?: string;
  birthday?: string;
  gender?: string;
  address?: string;
  school?: string;
  yearLevel?: string;
}

@Component({
  selector: 'app-admin-applicants',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AdminSidenavComponent,
    AdminTopnavComponent
  ],
  templateUrl: './admin-applicants.component.html',
  styleUrls: ['./admin-applicants.component.css']
})
export class AdminApplicantsComponent {

  selectedApplicant: Applicant | null = null;

  applicants: Applicant[] = [
    {
      name: 'Juan Dela Cruz',
      studentId: '2023-001',
      course: 'BSIT',
      email: 'juan@email.com',
      status: 'pending'
    },
    {
      name: 'Maria Santos',
      studentId: '2023-002',
      course: 'BSCS',
      email: 'maria@email.com',
      status: 'approved'
    },
    {
      name: 'Mark Reyes',
      studentId: '2023-003',
      course: 'BSIS',
      email: 'mark@email.com',
      status: 'declined'
    }
  ];

  filteredApplicants: Applicant[] = [...this.applicants];

  // FILTER BY STATUS
  filterStatus(event: any) {
    const value = event.target.value;

    if (value === 'all') {
      this.filteredApplicants = [...this.applicants];
    } else {
      this.filteredApplicants = this.applicants.filter(
        app => app.status === value
      );
    }
  }

  // SEARCH
  onSearch(event: any) {
    const keyword = event.target.value.toLowerCase();

    this.filteredApplicants = this.applicants.filter(app =>
      app.name.toLowerCase().includes(keyword) ||
      app.email.toLowerCase().includes(keyword) ||
      app.course.toLowerCase().includes(keyword)
    );
  }

  openModal(applicant: Applicant) {
    this.selectedApplicant = applicant;
  }

  closeModal() {
    this.selectedApplicant = null;
  }
}