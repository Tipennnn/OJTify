import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment.example';


interface Applicant {
  $id: string;
  auth_user_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  contact_number: string;
  birthday: string;
  gender: string;
  home_address: string;
  student_id: string;
  school_name: string;
  course: string;
  year_level: string;
  resume_file_id: string;
  endorsement_file_id: string;
  coe_file_id: string;
  status: string;
}

@Component({
  selector: 'app-admin-applicants',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    AdminSidenavComponent,
    AdminTopnavComponent
  ],
  templateUrl: './admin-applicants.component.html',
  styleUrls: ['./admin-applicants.component.css']
})
export class AdminApplicantsComponent implements OnInit {

  // 🔥 SIDENAV STATE
  isCollapsed = false;

  // DATA
  applicants        : Applicant[] = [];
  filteredApplicants: Applicant[] = [];
  selectedApplicant : Applicant | null = null;
  loading           = false;
  actionLoading     = false;
  searchQuery       = '';
  statusFilter      = 'all';

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

  // 🔥 RECEIVE SIDENAV TOGGLE
  onToggleSidebar(state: boolean) {
    this.isCollapsed = state;
  }

  async ngOnInit() {
    await this.loadApplicants();
  }

  async loadApplicants() {
    this.loading = true;
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.APPLICANTS_COL
      );
      this.applicants         = res.documents as any[];
      this.filteredApplicants = [...this.applicants];
    } catch (error: any) {
      console.error('Failed to load applicants:', error.message);
    } finally {
      this.loading = false;
    }
  }

  filterStatus(event: any) {
    this.statusFilter = event.target.value;
    this.applyFilter();
  }

  onSearch(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.applyFilter();
  }

  applyFilter() {
    this.filteredApplicants = this.applicants.filter(a => {
      const matchStatus = this.statusFilter === 'all' || a.status === this.statusFilter;
      const fullName    = `${a.first_name} ${a.last_name}`.toLowerCase();
      const matchSearch = !this.searchQuery ||
        fullName.includes(this.searchQuery) ||
        a.email.toLowerCase().includes(this.searchQuery) ||
        a.course.toLowerCase().includes(this.searchQuery);
      return matchStatus && matchSearch;
    });
  }

  getFileUrl(fileId: string, mode: 'view' | 'download' = 'view'): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/${mode}?project=${this.PROJECT_ID}`;
  }

  // ── Send email via Brevo ──────────────────────────────────
  async sendEmail(applicant: Applicant, type: 'approved' | 'declined') {
    try {
      const templateId = type === 'approved'
          ? environment.brevoApprovedTid
          : environment.brevoDeclinedTid;

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': environment.brevoApiKey
        },
        body: JSON.stringify({
          sender: {
            name:  'OJTify Admin',
            email: 'adminojtify@gmail.com'
          },
          to: [{
            email: applicant.email,
            name:  `${applicant.first_name} ${applicant.last_name}`
          }],
          templateId: templateId,
          params: {
            applicant_name: `${applicant.first_name} ${applicant.last_name}`,
            first_name:     applicant.first_name
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Brevo error:', err);
      } else {
        console.log(`Email sent to ${applicant.email}`);
      }

    } catch (error) {
      console.error('Failed to send email:', error);
    }
  }

  // ── Approve applicant ─────────────────────────────────────
  async approveApplicant(applicant: Applicant, event: Event) {
    event.stopPropagation();

    const result = await Swal.fire({
      title: 'Approve applicant?',
      text: `${applicant.first_name} ${applicant.last_name} will be added as an intern.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, approve',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    this.actionLoading = true;

    try {
      await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        applicant.auth_user_id,
        {
          first_name:          applicant.first_name,
          middle_name:         applicant.middle_name,
          last_name:           applicant.last_name,
          email:               applicant.email,
          contact_number:      applicant.contact_number,
          birthday:            applicant.birthday,
          gender:              applicant.gender,
          home_address:        applicant.home_address,
          student_id:          applicant.student_id,
          school_name:         applicant.school_name,
          course:              applicant.course,
          year_level:          applicant.year_level,
          resume_file_id:      applicant.resume_file_id      || '',
          endorsement_file_id: applicant.endorsement_file_id || '',
          coe_file_id:         applicant.coe_file_id         || ''
        }
      );

      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.APPLICANTS_COL,
        applicant.$id,
        { status: 'approved' }
      );

      await this.sendEmail(applicant, 'approved');

      const index = this.applicants.findIndex(a => a.$id === applicant.$id);
      if (index !== -1) this.applicants[index].status = 'approved';
      this.applyFilter();

      if (this.selectedApplicant?.$id === applicant.$id) {
        this.selectedApplicant.status = 'approved';
      }

      Swal.fire({
        icon: 'success',
        title: 'Approved!',
        html: `<b>${applicant.first_name} ${applicant.last_name}</b> is now an active intern.<br>
               <span style="font-size:13px; color:#6b7280;">
                 An email notification has been sent to ${applicant.email}
               </span>`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed', text: error.message });
    } finally {
      this.actionLoading = false;
    }
  }

  // ── Decline applicant ─────────────────────────────────────
  async declineApplicant(applicant: Applicant, event: Event) {
    event.stopPropagation();

    const result = await Swal.fire({
      title: 'Decline applicant?',
      text: `${applicant.first_name} ${applicant.last_name} will not be able to log in.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, decline',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    this.actionLoading = true;

    try {
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.APPLICANTS_COL,
        applicant.$id,
        { status: 'declined' }
      );

      await this.sendEmail(applicant, 'declined');

      const index = this.applicants.findIndex(a => a.$id === applicant.$id);
      if (index !== -1) this.applicants[index].status = 'declined';
      this.applyFilter();

      if (this.selectedApplicant?.$id === applicant.$id) {
        this.selectedApplicant.status = 'declined';
      }

      Swal.fire({
        icon: 'success',
        title: 'Declined!',
        html: `<b>${applicant.first_name} ${applicant.last_name}</b>'s application has been declined.<br>
               <span style="font-size:13px; color:#6b7280;">
                 An email notification has been sent to ${applicant.email}
               </span>`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed', text: error.message });
    } finally {
      this.actionLoading = false;
    }
  }

  openModal(applicant: Applicant) {
    this.selectedApplicant = applicant;
  }

  closeModal() {
    this.selectedApplicant = null;
  }

  getFullName(a: Applicant): string {
    return `${a.first_name} ${a.middle_name ? a.middle_name + ' ' : ''}${a.last_name}`;
  }
}