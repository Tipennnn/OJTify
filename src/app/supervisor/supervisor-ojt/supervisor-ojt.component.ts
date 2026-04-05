import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';

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
  $createdAt: string;
}

@Component({
  selector: 'app-supervisor-ojt',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SupervisorSidenavComponent,
    SupervisorTopnavComponent
  ],
  templateUrl: './supervisor-ojt.component.html',
  styleUrl: './supervisor-ojt.component.css'
})
export class SupervisorOjtComponent implements OnInit {

  students         : Student[] = [];
  filteredStudents : Student[] = [];
  loading          = false;
  searchQuery      = '';
  isCollapsed      = false;

  // Pagination
  currentPage  = 1;
  pageSize     = 10;
  totalPages   = 1;
  pageNumbers  : number[] = [];

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

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
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      // Only show students who have NOT yet completed their hours
      this.students = (res.documents as any[]).filter(s => {
        const completed = s.completed_hours || 0;
        const required  = s.required_hours  || 500;
        return completed < required;
      });
      this.filteredStudents = [...this.students];
      this.updatePagination();
    } catch (error: any) {
      console.error('Failed to load students:', error.message);
    } finally {
      this.loading = false;
    }
  }

  onSearch(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.filteredStudents = this.students.filter(s => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      return fullName.includes(this.searchQuery)              ||
             s.student_id.toLowerCase().includes(this.searchQuery) ||
             s.course.toLowerCase().includes(this.searchQuery)     ||
             s.email.toLowerCase().includes(this.searchQuery);
    });
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages  = Math.max(1, Math.ceil(this.filteredStudents.length / this.pageSize));
    this.pageNumbers = Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number) {
    this.currentPage = page;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  get pagedStudents(): Student[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredStudents.slice(start, start + this.pageSize);
  }

  onToggleSidebar(collapsed: boolean) {
    this.isCollapsed = collapsed;
  }

  openProfile(student: Student) {
    this.router.navigate(['/supervisor-ojt-profile', student.$id]);
  }

  getFullName(s: Student): string {
    return `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`;
  }

  getPhotoUrl(photoId: string): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${photoId}/view?project=${this.PROJECT_ID}`;
  }

  getAvatarUrl(student: Student): string {
    if (student.profile_photo_id) {
      return this.getPhotoUrl(student.profile_photo_id);
    }
    const initials = `${student.first_name.charAt(0)} ${student.last_name.charAt(0)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0818A8&color=fff&size=64`;
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
}