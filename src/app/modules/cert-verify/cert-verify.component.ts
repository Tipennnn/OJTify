import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import { Query } from 'appwrite';

@Component({
  selector: 'app-cert-verify',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cert-verify.component.html',
  styleUrls: ['./cert-verify.component.css']
})
export class CertVerifyComponent implements OnInit {

  loading  = true;
  verified = false;
  error    = false;

  internName    = '';
  course        = '';
  school        = '';
  issuedDate    = '';
  hoursCompleted = 0;
  requiredHours  = 0;

  constructor(
    private route: ActivatedRoute,
    private appwrite: AppwriteService
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.error = true; this.loading = false; return; }

    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        [Query.equal('cert_verification_id', id), Query.limit(1)]
      );

      if (res.documents.length === 0) {
        this.error = true;
      } else {
        const doc = res.documents[0] as any;
        const firstName  = (doc.first_name  ?? '').trim();
        const middleName = (doc.middle_name ?? '').trim();
        const lastName   = (doc.last_name   ?? '').trim();
        this.internName    = [firstName, middleName, lastName].filter(Boolean).join(' ');
        this.course        = doc.course      ?? '';
        this.school        = doc.school_name ?? '';
        this.hoursCompleted = Number(doc.completed_hours ?? 0);
        this.requiredHours  = Number(doc.required_hours  ?? 500);
        this.issuedDate    = doc.cert_sent_date
          ? new Date(doc.cert_sent_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : '';
        this.verified = true;
      }
    } catch (err) {
      console.error(err);
      this.error = true;
    } finally {
      this.loading = false;
    }
  }
}