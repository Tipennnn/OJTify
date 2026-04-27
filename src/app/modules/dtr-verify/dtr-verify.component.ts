import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import { Query } from 'appwrite';

@Component({
  selector:    'app-dtr-verify',
  standalone:  true,
  imports:     [CommonModule],
  templateUrl: './dtr-verify.component.html',
  styleUrls:   ['./dtr-verify.component.css']
})
export class DtrVerifyComponent implements OnInit {

  loading = true;
  valid   = false;
  errorMessage = '';

  internName    = '';
  studentId     = '';
  schoolName    = '';
  course        = '';
  periodLabel   = '';
  generatedAt   = '';
  verifiedAt    = '';
  ref           = '';

  requiredHours  = 0;
  completedHours = 0;
  totalDays      = 0;
  presentDays    = 0;
  absentDays     = 0;

  get progressPercent(): number {
    if (!this.requiredHours) return 0;
    return Math.min(parseFloat(((this.completedHours / this.requiredHours) * 100).toFixed(1)), 100);
  }

  constructor(private route: ActivatedRoute, private appwrite: AppwriteService) {}

  async ngOnInit() {
    const refParam = this.route.snapshot.paramMap.get('ref') || '';
    this.ref = refParam;
    await this.verify(refParam);
  }

  async verify(refParam: string) {
    this.loading = true;

    if (!refParam) {
      this.valid = false;
      this.errorMessage = 'No document reference provided. This QR code is invalid.';
      this.loading = false;
      return;
    }

    try {
      // ── Look up DTR record by unique ref ──────────────────────────────────
      const dtrRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        'dtr_records',
        [Query.equal('ref', refParam), Query.limit(1)]
      );

      if (dtrRes.documents.length === 0) {
        this.valid = false;
        this.errorMessage = 'This reference code does not exist in the system. The document may be fabricated or tampered with.';
        this.loading = false;
        return;
      }

      const dtr = dtrRes.documents[0] as any;

      // ── Look up live student data ─────────────────────────────────────────
      let student: any = null;
      try {
        student = await this.appwrite.databases.getDocument(
          this.appwrite.DATABASE_ID,
          this.appwrite.STUDENTS_COL,
          dtr.student_doc_id
        );
      } catch { /* archived or deleted — use DTR snapshot */ }

      this.valid = true;

      this.internName = student
        ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
        : dtr.intern_name || '—';

      this.studentId      = student?.student_id      || dtr.student_id || '—';
      this.schoolName     = student?.school_name     || '—';
      this.course         = student?.course          || '—';
      this.requiredHours  = student?.required_hours  || 0;
      this.completedHours = student?.completed_hours || 0;
      this.periodLabel    = dtr.period_label         || '—';
      this.totalDays      = dtr.total_days           || 0;
      this.presentDays    = dtr.present_days         || 0;
      this.absentDays     = dtr.absent_days          || 0;

      this.generatedAt = new Date(dtr.generated_at).toLocaleString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      this.verifiedAt = new Date().toLocaleString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

    } catch (err: any) {
      this.valid        = false;
      this.errorMessage = 'An error occurred while verifying. Please try again later.';
      console.error('DTR verify error:', err);
    } finally {
      this.loading = false;
    }
  }
}