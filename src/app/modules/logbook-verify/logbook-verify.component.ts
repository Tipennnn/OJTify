import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import { Query } from 'appwrite';

@Component({
  selector:    'app-logbook-verify',
  standalone:  true,
  imports:     [CommonModule],
  templateUrl: './logbook-verify.component.html',
  styleUrls:   ['./logbook-verify.component.css']
})
export class LogbookVerifyComponent implements OnInit {

  loading      = true;
  valid        = false;
  errorMessage = '';

  ref          = '';
  internName   = '';
  studentId    = '';
  schoolName   = '';
  course       = '';
  periodLabel  = '';
  weekStart    = '';
  weekEnd      = '';
  totalEntries = 0;
  generatedAt  = '';
  verifiedAt   = '';

  constructor(
    private route:    ActivatedRoute,
    private appwrite: AppwriteService
  ) {}

  async ngOnInit() {
    // Route: /verify/logbook/:ref
    this.ref = this.route.snapshot.paramMap.get('ref') || '';
    await this.verify(this.ref);
  }

  async verify(refParam: string) {
    this.loading = true;

    if (!refParam) {
      this.valid        = false;
      this.errorMessage = 'No document reference provided. This QR code is invalid.';
      this.loading      = false;
      return;
    }

    try {
      // ── Step 1: Look up the logbook record by ref ─────────────────────────
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        'logbook_records',
        [Query.equal('ref', refParam), Query.limit(1)]
      );

      if (res.documents.length === 0) {
        this.valid        = false;
        this.errorMessage = 'This reference code was not found in the system. The document may be fake or has been altered.';
        this.loading      = false;
        return;
      }

      const record = res.documents[0] as any;

      // ── Step 2: Look up live student data ─────────────────────────────────
      let student: any = null;
      try {
        // find by Appwrite account $id (student_id in logbook_records = currentUserId)
        student = await this.appwrite.databases.getDocument(
          this.appwrite.DATABASE_ID,
          this.appwrite.STUDENTS_COL,
          record.student_id
        );
      } catch {
        // student may have been archived; we still show the record data
      }

      this.valid = true;

      this.internName = student
        ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
        : record.intern_name || '—';

      this.studentId   = student?.student_id  || '—';
      this.schoolName  = student?.school_name || '—';
      this.course      = student?.course      || '—';
      this.periodLabel = record.period_label  || '—';
      this.weekStart   = record.week_start
        ? new Date(record.week_start).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
        : '—';
      this.weekEnd     = record.week_end
        ? new Date(record.week_end).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
        : '—';
      this.totalEntries = record.total_entries || 0;
      this.generatedAt  = new Date(record.generated_at).toLocaleString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      this.verifiedAt   = new Date().toLocaleString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

    } catch (err: any) {
      this.valid        = false;
      this.errorMessage = 'An error occurred while verifying. Please try again later.';
      console.error('Logbook verify error:', err);
    } finally {
      this.loading = false;
    }
  }
}