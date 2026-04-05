import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
  contact_number?: string;
  birthday?: string;
  gender?: string;
  home_address?: string;
  year_level?: string;
  profile_photo_id?: string;
  resume_file_id?: string;
  endorsement_file_id?: string;
  coe_file_id?: string;
  required_hours?: number;
  completed_hours?: number;
  $createdAt: string;
}

@Component({
  selector: 'app-supervisor-ojt-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './supervisor-ojt-profile.component.html',
  styleUrl: './supervisor-ojt-profile.component.css'
})
export class SupervisorOjtProfileComponent implements OnInit {

  student : Student | null = null;
  loading = false;

  Math = Math;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(
    private appwrite: AppwriteService,
    private route   : ActivatedRoute,
    private router  : Router
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) await this.loadStudent(id);
  }

  async loadStudent(id: string) {
    this.loading = true;
    try {
      const doc = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        id
      );
      this.student = doc as any;
    } catch (error: any) {
      console.error('Failed to load student:', error.message);
    } finally {
      this.loading = false;
    }
  }

  goBack() { this.router.navigate(['/supervisor-ojt']); }

  getFullName(): string {
    if (!this.student) return '';
    return `${this.student.first_name} ${this.student.middle_name ? this.student.middle_name + ' ' : ''}${this.student.last_name}`;
  }

  getPhotoUrl(): string {
    if (this.student?.profile_photo_id) {
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${this.student.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    }
    const initials = `${this.student?.first_name?.charAt(0) || 'U'} ${this.student?.last_name?.charAt(0) || ''}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2563eb&color=fff&size=128`;
  }

  getFileUrl(fileId: string, mode: 'view' | 'download' = 'view'): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/${mode}?project=${this.PROJECT_ID}`;
  }

  getProgress(): number {
    if (!this.student) return 0;
    const completed = this.student.completed_hours || 0;
    const required  = this.student.required_hours  || 500;
    return Math.min(parseFloat(((completed / required) * 100).toFixed(1)), 100);
  }

  getRemainingHours(): number {
    if (!this.student) return 0;
    const completed = this.student.completed_hours || 0;
    const required  = this.student.required_hours  || 500;
    return Math.max(required - completed, 0);
  }
}