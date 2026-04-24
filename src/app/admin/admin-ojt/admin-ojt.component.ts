import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';

interface Student {
  $id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  student_id: string;
  course: string;
  school_name: string;
  email: string;
  profile_photo_id?: string;
  required_hours?: number;
  completed_hours?: number;
  cert_sent?: boolean;        // ← add
  supervisor_id?: string;     // ← add
  ojt_start?: string;         // ← add
  ojt_end?: string;           // ← add
  $createdAt: string;
}

@Component({
  selector: 'app-admin-ojt',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AdminSidenavComponent,
    AdminTopnavComponent
  ],
  templateUrl: './admin-ojt.component.html',
  styleUrl: './admin-ojt.component.css'
})
export class AdminOjtComponent implements OnInit {

  students        : Student[] = [];
  filteredStudents: Student[] = [];
  loading         = false;
  searchQuery     = '';
  isCollapsed     = false;
  archivingId: string | null = null; // tracks which student is being archived
  evaluatedStudentIds: Set<string> = new Set();

  // PAGINATION
  currentPage  = 1;
  pageSize     = 10;
  readonly Math = Math;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  readonly APPWRITE_PAGE_SIZE = 100; // fetch 100 at a time from Appwrite

  constructor(
    private appwrite: AppwriteService,
    private router  : Router
  ) {}

  async ngOnInit() {
    await this.loadStudents();
  }

 async loadStudents() {
  this.loading = true;
  try {
    const { Query } = await import('appwrite');

    // Fetch ALL students using pagination (handles 100+ interns)
    let allStudents: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        [Query.limit(this.APPWRITE_PAGE_SIZE), Query.offset(offset)]
      );
      allStudents = [...allStudents, ...res.documents];
      hasMore = res.documents.length === this.APPWRITE_PAGE_SIZE;
      offset += this.APPWRITE_PAGE_SIZE;
    }

    // Fetch archives and evaluations (same approach)
    const [archiveRes, evalRes] = await Promise.all([
      this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ARCHIVES_COL,
        [Query.limit(500)]
      ),
      this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.EVALUATIONS_COL,
        [Query.limit(500)]
      )
    ]);

    const archivedIds = new Set(
      archiveRes.documents.map((d: any) => d.student_doc_id)
    );

    this.evaluatedStudentIds = new Set(
      evalRes.documents.map((e: any) => e.student_id_ref)
    );

    this.students = allStudents.filter(s => !archivedIds.has(s.$id));
    this.filteredStudents = [...this.students];

  } catch (error: any) {
    console.error('Failed to load students:', error.message);
  } finally {
    this.loading = false;
  }
}

  // PAGINATION
  get pagedStudents(): Student[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredStudents.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredStudents.length / this.pageSize) || 1;
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  prevPage() { this.goToPage(this.currentPage - 1); }
  nextPage() { this.goToPage(this.currentPage + 1); }

  onToggleSidebar(collapsed: boolean) {
    this.isCollapsed = collapsed;
  }

  openProfile(student: Student) {
    this.router.navigate(['/admin-ojt-profile', student.$id]);
  }

  onSearch(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.currentPage = 1;
    this.filteredStudents = this.students.filter(s => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      return fullName.includes(this.searchQuery) ||
             s.student_id.toLowerCase().includes(this.searchQuery) ||
             s.course.toLowerCase().includes(this.searchQuery) ||
             s.email.toLowerCase().includes(this.searchQuery);
    });
  }

  getFullName(s: Student): string {
    return `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`;
  }

  getPhotoUrl(photoId: string): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${photoId}/view?project=${this.PROJECT_ID}`;
  }

  getProgress(s: Student): number {
    const completed = s.completed_hours || 0;
    const required  = s.required_hours  || 500;
    return Math.min(parseFloat(((completed / required) * 100).toFixed(1)), 100);
  }

  getStartDate(student: Student): string {
    return new Date(student.$createdAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  getAvatarUrl(student: Student): string {
    if (student.profile_photo_id) {
      return this.getPhotoUrl(student.profile_photo_id);
    }
    const initials = `${student.first_name.charAt(0)} ${student.last_name.charAt(0)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2563eb&color=fff&size=64`;
  }
 async archiveStudent(event: MouseEvent, student: Student) {
  event.stopPropagation();

  const required  = student.required_hours  || 500;
  const completed = student.completed_hours || 0;

  // Build missing requirements list for SweetAlert
  const missing: string[] = [];
  if (completed < required)
    missing.push(`<li>❌ Hours not completed <b>(${completed}/${required} hrs)</b></li>`);
  if (!student.cert_sent)
    missing.push('<li>❌ Certificate not yet sent</li>');
  if (!this.evaluatedStudentIds.has(student.$id))
    missing.push('<li>❌ No evaluation submitted</li>');

  // Show requirements not met
  if (missing.length > 0) {
    await Swal.fire({
      icon: 'warning',
      title: 'Cannot Archive Yet',
      html: `
        <p style="font-size:13px;color:#6b7280;margin-bottom:10px;">
          <b>${this.getFullName(student)}</b> is missing the following requirements:
        </p>
        <ul style="text-align:left;font-size:13px;color:#374151;line-height:2;">
          ${missing.join('')}
        </ul>
      `,
      confirmButtonText: 'OK',
      confirmButtonColor: '#2563eb'
    });
    return;
  }

  // All conditions met — confirm archive
  const result = await Swal.fire({
    icon: 'question',
    title: 'Archive Intern?',
    html: `
      <p style="font-size:13px;color:#6b7280;">
        Are you sure you want to archive <b>${this.getFullName(student)}</b>?
      </p>
      <div style="margin-top:12px;padding:12px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#374151;text-align:left;line-height:1.8;">
        <div>✅ Hours completed (${completed}/${required} hrs)</div>
        <div>✅ Certificate sent</div>
        <div>✅ Evaluation submitted</div>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin-top:10px;">
        This will move them to <b>Completed OJT</b>.
      </p>
    `,
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-box-archive"></i> Archive',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#e5e7eb',
    reverseButtons: true
  });

  if (!result.isConfirmed) return;

  this.archivingId = student.$id;
  try {
    await this.appwrite.checkAndArchiveStudent(student.$id);
    this.students         = this.students.filter(s => s.$id !== student.$id);
    this.filteredStudents = this.filteredStudents.filter(s => s.$id !== student.$id);

    await Swal.fire({
      icon: 'success',
      title: 'Archived!',
      text: `${this.getFullName(student)} has been moved to Completed OJT.`,
      confirmButtonColor: '#2563eb',
      timer: 2500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
      timerProgressBar: true
    });

  } catch (e: any) {
    await Swal.fire({
      icon: 'error',
      title: 'Archive Failed',
      text: e.message,
      confirmButtonColor: '#2563eb'
    });
  } finally {
    this.archivingId = null;
  }
}

canArchive(student: Student): boolean {
  const completed = student.completed_hours || 0;
  const required  = student.required_hours  || 500;
  return completed >= required
    && !!student.cert_sent
    && this.evaluatedStudentIds.has(student.$id); // ← add this
}
getArchiveTooltip(student: Student): string {
  const completed = student.completed_hours || 0;
  const required  = student.required_hours  || 500;

  const missing: string[] = [];

  if (completed < required)
    missing.push(`❌ Hours not completed (${completed}/${required} hrs)`);

  if (!student.cert_sent)
    missing.push('❌ Certificate not yet sent');

  if (!this.evaluatedStudentIds.has(student.$id))
    missing.push('❌ No evaluation submitted');

  if (missing.length === 0)
    return '✅ All requirements met — click to archive';

  return 'Cannot archive yet:\n' + missing.join('\n');
}
}