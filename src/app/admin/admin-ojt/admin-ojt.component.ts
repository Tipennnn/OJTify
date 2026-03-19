import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';

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

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

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
      this.students         = res.documents as any[];
      this.filteredStudents = [...this.students];
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

  getStartDate(student: Student): string {
    return new Date(student.$createdAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}