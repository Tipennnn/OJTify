import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InternSidenavComponent } from '../../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../../intern-topnav/intern-topnav.component';
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
  required_hours?: number;
  completed_hours?: number;
  $createdAt: string;
}

interface Evaluation {
  $id?: string;
  student_id_ref: string;
  punctuality: number;
  attendance: number;
  quality_of_work: number;
  productivity: number;
  initiative: number;
  cooperation: number;
  communication: number;
  professionalism: number;
  dependability: number;
  remarks: string;
  strengths?: string;
  areas_for_improvement?: string;
  recommendation?: 'highly_recommended' | 'recommended' | 'recommended_with_reservations' | 'not_recommended';
  signature_data: string;
  evaluated_at: string;
  period_from?: string;
  period_to?: string;
}

interface SupervisorInfo {
  $id: string;
  first_name: string;
  last_name: string;
  position?: string;
  company_name?: string;
  department?: string;
  email?: string;
}

@Component({
  selector: 'app-intern-evaluation',
  standalone: true,
  imports: [CommonModule, RouterModule, InternSidenavComponent, InternTopnavComponent],
  templateUrl: './intern-evaluation.component.html',
  styleUrl: './intern-evaluation.component.css'
})
export class InternEvaluationComponent implements OnInit {

  loading       = true;
  hasEvaluation = false;

  student    : Student | null = null;
  evaluation : Evaluation | null = null;
  supervisor : SupervisorInfo | null = null;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';
  readonly EVAL_COL   = 'evaluations';
  readonly SUP_COL    = 'supervisors';
  readonly SCHOOL     = 'Olongapo City Elementary School';
  readonly AY         = 'A.Y. 2023 – 2024';

  readonly CRITERIA_KEYS = [
    'punctuality', 'attendance', 'quality_of_work', 'productivity',
    'initiative', 'cooperation', 'communication', 'professionalism', 'dependability'
  ];

  private readonly DUMMY_STUDENT: Student = {
    $id: 'd1', first_name: 'Juan', middle_name: 'S.', last_name: 'Dela Cruz',
    student_id: '2021-00123', course: 'Bachelor of Science in Information Technology',
    school_name: 'Olongapo City Elementary School', email: 'juan.delacruz@student.edu.ph',
    required_hours: 500, completed_hours: 500, $createdAt: '2024-01-01T00:00:00.000Z'
  };

  private readonly DUMMY_EVALUATION: Evaluation = {
    student_id_ref: 'd1',
    punctuality: 5, attendance: 5, quality_of_work: 4, productivity: 4,
    initiative: 4, cooperation: 5, communication: 4, professionalism: 5,
    dependability: 5,
    remarks: 'Juan has demonstrated exceptional dedication and professionalism throughout his OJT period. His meticulous attention to detail, punctuality, and collaborative spirit contributed meaningfully to the team. He is highly recommended for any future professional endeavor.',
    strengths: 'Strong work ethic, excellent punctuality, collaborative attitude, and demonstrates initiative in completing assigned tasks.',
    areas_for_improvement: 'Can further develop technical writing skills and improve documentation practices.',
    recommendation: 'highly_recommended',
    signature_data: '',
    evaluated_at: '2024-03-20T10:30:00.000Z',
    period_from: '2024-01-08T00:00:00.000Z',
    period_to: '2024-03-20T00:00:00.000Z'
  };

  private readonly DUMMY_SUPERVISOR: SupervisorInfo = {
    $id: 's1', first_name: 'Maria', last_name: 'Santos',
    position: 'Department Head, Information Technology',
    company_name: 'Olongapo City Elementary School',
    department: 'Information Technology',
    email: 'msantos@olongapocity.edu.ph'
  };

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() { await this.loadData(); }

  async loadData() {
    this.loading = true;
    try {
      const account = await this.appwrite.account.get();
      const sRes    = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL);
      const matched = (sRes.documents as any[]).find(s => s.user_id === account.$id || s.email === account.email);
      this.student  = matched ?? this.DUMMY_STUDENT;

      const eRes = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.EVAL_COL);
      const ev   = (eRes.documents as any[]).find(e => e.student_id_ref === this.student!.$id);

      if (ev) {
        this.evaluation    = ev as Evaluation;
        this.hasEvaluation = true;
        try {
          const supRes    = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.SUP_COL);
          const sup       = (supRes.documents as any[]).find(s => s.student_id_ref === this.student!.$id || s.student_ids?.includes(this.student!.$id));
          this.supervisor = sup ?? this.DUMMY_SUPERVISOR;
        } catch { this.supervisor = this.DUMMY_SUPERVISOR; }
      } else {
        this.hasEvaluation = false;
      }
    } catch {
      this.student      = this.DUMMY_STUDENT;
      this.evaluation   = this.DUMMY_EVALUATION;
      this.supervisor   = this.DUMMY_SUPERVISOR;
      this.hasEvaluation = true;
    } finally {
      this.loading = false;
    }
  }

  getRating(key: string): number {
    return this.evaluation ? (this.evaluation as any)[key] ?? 0 : 0;
  }

  getRatingLabel(v: number): string {
    return ['—', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][v] ?? '—';
  }

  getOverallAverage(): number {
    if (!this.evaluation) return 0;
    const vals = this.CRITERIA_KEYS
      .map(k => (this.evaluation as any)[k])
      .filter((v: number) => v > 0);
    if (!vals.length) return 0;
    return parseFloat((vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(2));
  }

  getOverallLabel(avg: number): string {
    if (avg >= 4.5) return 'Excellent';
    if (avg >= 3.5) return 'Very Good';
    if (avg >= 2.5) return 'Good';
    if (avg >= 1.5) return 'Fair';
    return avg > 0 ? 'Poor' : '';
  }

  getProgress(): number {
    if (!this.student) return 0;
    return Math.min(
      parseFloat((((this.student.completed_hours ?? 0) / (this.student.required_hours ?? 500)) * 100).toFixed(1)),
      100
    );
  }

  getFullName(): string {
    if (!this.student) return '';
    const m = this.student.middle_name ? ` ${this.student.middle_name}` : '';
    return `${this.student.first_name}${m} ${this.student.last_name}`;
  }

  getAvatarUrl(): string {
    if (!this.student) return '';
    if (this.student.profile_photo_id)
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${this.student.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    const n = encodeURIComponent(`${this.student.first_name[0]}+${this.student.last_name[0]}`);
    return `https://ui-avatars.com/api/?name=${n}&background=0818A8&color=fff&size=128&bold=true`;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  getEvaluationPeriod(): string {
    if (!this.evaluation?.period_from) return this.AY;
    return this.formatDate(this.evaluation.period_from) + ' – ' + this.formatDate(this.evaluation.period_to ?? '');
  }

  printEvaluation() { window.print(); }
}