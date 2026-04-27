import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import { Query } from 'appwrite';

interface VerifyResult {
  valid: boolean;
  internName?: string;
  studentId?: string;
  schoolName?: string;
  course?: string;
  requiredHours?: number;
  completedHours?: number;
  ref?: string;
  verifiedAt?: string;
  errorMessage?: string;
}

@Component({
  selector: 'app-dtr-verify',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dtr-verify.component.html',
  styleUrls: ['./dtr-verify.component.css']
})
export class DtrVerifyComponent implements OnInit {

  loading     = true;
  result: VerifyResult | null = null;

  certId  = '';
  dtrRef  = '';
  studentParam = '';

  constructor(
    private route: ActivatedRoute,
    private appwrite: AppwriteService
  ) {}

  async ngOnInit() {
    // URL pattern: /verify/:certId?dtr=REF  OR  /verify/dtr?student=ID&ref=REF
    this.certId       = this.route.snapshot.paramMap.get('certId') || '';
    this.dtrRef       = this.route.snapshot.queryParamMap.get('dtr') || '';
    this.studentParam = this.route.snapshot.queryParamMap.get('student') || '';
    const refParam    = this.route.snapshot.queryParamMap.get('ref') || '';
    if (!this.dtrRef && refParam) this.dtrRef = refParam;

    await this.verify();
  }

  async verify() {
    this.loading = true;
    try {
      let studentDoc: any = null;

      // Try to find by cert_verification_id first
      if (this.certId && this.certId !== 'dtr') {
        try {
          const res = await this.appwrite.databases.listDocuments(
            this.appwrite.DATABASE_ID,
            this.appwrite.STUDENTS_COL,
            [Query.equal('cert_verification_id', this.certId), Query.limit(1)]
          );
          if (res.documents.length > 0) studentDoc = res.documents[0];
        } catch { /* ignore */ }
      }

      // Fallback: find by student_id param
      if (!studentDoc && this.studentParam) {
        try {
          const res = await this.appwrite.databases.listDocuments(
            this.appwrite.DATABASE_ID,
            this.appwrite.STUDENTS_COL,
            [Query.equal('student_id', this.studentParam), Query.limit(1)]
          );
          if (res.documents.length > 0) studentDoc = res.documents[0];
        } catch { /* ignore */ }
      }

      if (!studentDoc) {
        this.result = {
          valid: false,
          errorMessage: 'No intern record found matching this QR code. This document may be invalid or tampered.'
        };
        return;
      }

      // Validate ref code format: DTR-YYYYMMDD-XXXX-RAND
      const refValid = this.dtrRef
        ? /^DTR-\d{8}-\d{4}-[A-Z0-9]{4}$/.test(this.dtrRef)
        : false;

      if (!refValid && this.dtrRef) {
        this.result = {
          valid: false,
          errorMessage: 'The document reference code format is invalid. This document may have been altered.'
        };
        return;
      }

      // Build first + middle + last
      const fullName = [
        studentDoc.first_name  || '',
        studentDoc.middle_name || '',
        studentDoc.last_name   || ''
      ].filter(Boolean).join(' ');

      this.result = {
        valid:          true,
        internName:     fullName || studentDoc.name || '—',
        studentId:      studentDoc.student_id      || '—',
        schoolName:     studentDoc.school_name     || '—',
        course:         studentDoc.course          || '—',
        requiredHours:  studentDoc.required_hours  || 500,
        completedHours: studentDoc.completed_hours || 0,
        ref:            this.dtrRef                || '—',
        verifiedAt:     new Date().toLocaleString('en-PH', {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })
      };

    } catch (err: any) {
      this.result = {
        valid: false,
        errorMessage: 'An error occurred while verifying this document. Please try again later.'
      };
      console.error('DTR verify error:', err);
    } finally {
      this.loading = false;
    }
  }

  get progressPercent(): number {
    if (!this.result?.requiredHours) return 0;
    return Math.min(
      parseFloat(((( this.result.completedHours || 0) / this.result.requiredHours) * 100).toFixed(1)),
      100
    );
  }
}