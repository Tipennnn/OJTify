import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';

interface Applicant {
  profile: string;
  name: string;
  studentId: string;
  course: string;
  email: string;
  status?: string;
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

  selectedApplicant: any = null;

  applicants = [
    {
      name: 'Juan Dela Cruz',
      firstName: 'Juan',
      middleName: 'Santos',
      lastName: 'Dela Cruz',
      studentId: '2023-001',
      course: 'BSIT',
      email: 'juan@email.com',
      contact: '09123456789',
      birthday: '2002-01-01',
      gender: 'Male',
      address: 'Manila',
      school: 'ABC University',
      yearLevel: '3rd Year',
      resume: 'resume.pdf',
      endorsement: 'endorsement.pdf',
      certificate: 'certificate.pdf'
    }
  ];

  openModal(applicant: any) {
    this.selectedApplicant = applicant;
  }

  closeModal() {
    this.selectedApplicant = null;
  }

  approve(applicant: any) {
    alert('Approved: ' + applicant.name);
  }

  decline(applicant: any) {
    alert('Declined: ' + applicant.name);
  }

}