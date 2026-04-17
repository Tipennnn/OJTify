import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InternSidenavComponent } from '../../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  supervisor_id?: string;
  supervisor_name?: string;
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
  intern_signature?: string;   // ← NEW: intern's own e-signature
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

  // ── Intern signature ─────────────────────────────────────────────────────
  isDrawing        = false;
  lastX            = 0;
  lastY            = 0;
  hasInternSig     = false;
  signatureMode    : 'draw' | 'upload' = 'draw';
  uploadedFileName = '';
  savingSig        = false;
  private canvas   : HTMLCanvasElement | null = null;
  private ctx      : CanvasRenderingContext2D | null = null;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';
  readonly EVAL_COL   = 'evaluations';
  readonly SUP_COL    = 'supervisors';
  readonly SCHOOL     = 'Olongapo City Elementary School';
  readonly AY         = 'A.Y. 2024 – 2025';

  readonly CRITERIA_KEYS = [
    'punctuality', 'attendance', 'quality_of_work', 'productivity',
    'initiative', 'cooperation', 'communication', 'professionalism', 'dependability'
  ];

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() { await this.loadData(); }

  async loadData() {
    this.loading = true;
    try {
      const account = await this.appwrite.account.get();

      try {
        const studentDoc = await this.appwrite.databases.getDocument(
          this.appwrite.DATABASE_ID,
          this.appwrite.STUDENTS_COL,
          account.$id
        );
        this.student = studentDoc as any;
      } catch {
        const sRes = await this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.STUDENTS_COL
        );
        this.student = (sRes.documents as any[]).find(
          s => s.email === account.email
        ) ?? null;
      }

      if (!this.student) {
        this.hasEvaluation = false;
        this.loading = false;
        return;
      }

      const eRes = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.EVAL_COL
      );
      const ev = (eRes.documents as any[]).find(
        e => e.student_id_ref === this.student!.$id
      );

      if (ev) {
        this.evaluation    = ev as Evaluation;
        this.hasEvaluation = true;
        this.hasInternSig  = !!ev.intern_signature;

        if (ev.supervisor_id) {
          try {
            const supDoc = await this.appwrite.databases.getDocument(
              this.appwrite.DATABASE_ID,
              this.SUP_COL,
              ev.supervisor_id
            );
            this.supervisor = supDoc as any;
          } catch {
            this.buildSupervisorFromName(ev);
          }
        } else if (ev.supervisor_name) {
          this.buildSupervisorFromName(ev);
        }

        // Init canvas after view renders; restore existing intern sig if any
        setTimeout(() => {
          this.initCanvas();
          if (ev.intern_signature && this.ctx && this.canvas) {
            const img = new Image();
            img.onload = () => this.ctx!.drawImage(img, 0, 0, this.canvas!.width, this.canvas!.height);
            img.src    = ev.intern_signature;
          }
        }, 300);

      } else {
        this.hasEvaluation = false;
      }

    } catch (err: any) {
      console.error('loadData error:', err.message);
      this.hasEvaluation = false;
    } finally {
      this.loading = false;
    }
  }

  private buildSupervisorFromName(ev: any) {
    const parts = (ev.supervisor_name ?? '').split(' ');
    this.supervisor = {
      $id        : ev.supervisor_id ?? '',
      first_name : parts[0] ?? 'Supervisor',
      last_name  : parts.slice(1).join(' ') ?? '',
      position   : ev.supervisor_position   ?? undefined,
      company_name: ev.supervisor_company   ?? undefined,
      department : ev.supervisor_department ?? undefined,
      email      : ev.supervisor_email      ?? undefined
    };
  }

  // ── Rating helpers ────────────────────────────────────────────────────────

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

  // ── Recommendation helper ─────────────────────────────────────────────────

  isRecommendationActive(value: string): boolean {
    if (this.evaluation?.recommendation) {
      return this.evaluation.recommendation === value;
    }
    const avg = this.getOverallAverage();
    if (value === 'highly_recommended')            return avg >= 4.5;
    if (value === 'recommended')                   return avg >= 3.5 && avg < 4.5;
    if (value === 'recommended_with_reservations') return avg >= 2.5 && avg < 3.5;
    if (value === 'not_recommended')               return avg > 0 && avg < 2.5;
    return false;
  }

  // ── Progress & name helpers ───────────────────────────────────────────────

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

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  getEvaluationPeriod(): string {
    if (!this.evaluation?.period_from) return this.AY;
    const from = this.formatDate(this.evaluation.period_from);
    const to   = this.formatDate(this.evaluation.period_to ?? '');
    return `${from} – ${to}`;
  }

  // ── Intern Signature Canvas ───────────────────────────────────────────────

  initCanvas() {
    this.canvas = document.getElementById('internSigCanvas') as HTMLCanvasElement;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.strokeStyle = '#0818A8';
      this.ctx.lineWidth   = 2;
      this.ctx.lineCap     = 'round';
      this.ctx.lineJoin    = 'round';
    }
  }

  onMouseDown(e: MouseEvent) {
    if (this.hasInternSig && this.evaluation?.intern_signature) return; // lock after saved
    this.isDrawing = true;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    this.lastX = (e.clientX - rect.left) * (this.canvas!.width  / rect.width);
    this.lastY = (e.clientY - rect.top)  * (this.canvas!.height / rect.height);
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isDrawing || !this.ctx) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x    = (e.clientX - rect.left) * (this.canvas!.width  / rect.width);
    const y    = (e.clientY - rect.top)  * (this.canvas!.height / rect.height);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x; this.lastY = y;
    this.hasInternSig = true;
  }

  onMouseUp()    { this.isDrawing = false; }
  onMouseLeave() { this.isDrawing = false; }

  onTouchStart(e: TouchEvent) {
    e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const t    = e.touches[0];
    this.lastX = (t.clientX - rect.left) * (this.canvas!.width  / rect.width);
    this.lastY = (t.clientY - rect.top)  * (this.canvas!.height / rect.height);
    this.isDrawing = true;
  }

  onTouchMove(e: TouchEvent) {
    if (!this.isDrawing || !this.ctx) return;
    e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const t    = e.touches[0];
    const x    = (t.clientX - rect.left) * (this.canvas!.width  / rect.width);
    const y    = (t.clientY - rect.top)  * (this.canvas!.height / rect.height);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x; this.lastY = y;
    this.hasInternSig = true;
  }

  onTouchEnd() { this.isDrawing = false; }

  clearInternCanvas() {
    if (this.ctx && this.canvas) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasInternSig = false;
    this.uploadedFileName = '';
  }

  setSignatureMode(mode: 'draw' | 'upload') {
    this.signatureMode = mode;
    this.hasInternSig  = false;
    this.uploadedFileName = '';
    if (mode === 'draw') { setTimeout(() => { this.initCanvas(); this.clearInternCanvas(); }, 50); }
  }

  onSignatureImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    this.uploadedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img     = new Image();
      img.onload = () => {
        if (!this.canvas || !this.ctx) this.initCanvas();
        if (!this.canvas || !this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const canvasRatio = this.canvas.width / this.canvas.height;
        const imgRatio    = img.width / img.height;
        let drawW = this.canvas.width, drawH = this.canvas.height, drawX = 0, drawY = 0;
        if (imgRatio > canvasRatio) { drawH = this.canvas.width / imgRatio;  drawY = (this.canvas.height - drawH) / 2; }
        else                        { drawW = this.canvas.height * imgRatio; drawX = (this.canvas.width  - drawW) / 2; }
        this.ctx.drawImage(img, drawX, drawY, drawW, drawH);
        this.hasInternSig = true;
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  triggerFileInput() {
    const el = document.getElementById('internSigFileInput') as HTMLInputElement;
    if (el) el.click();
  }

  /** Save intern signature to the evaluation document in Appwrite */
  async saveInternSignature() {
    if (!this.hasInternSig || !this.canvas || !this.evaluation?.$id) return;
    this.savingSig = true;
    try {
      const sigData = this.canvas.toDataURL('image/png');
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.EVAL_COL,
        this.evaluation.$id,
        { intern_signature: sigData }
      );
      // Persist locally
      (this.evaluation as any).intern_signature = sigData;
      await Swal.fire({
        icon : 'success',
        title: 'Signature Saved!',
        text : 'Your e-signature has been saved successfully.',
        confirmButtonColor: '#0818A8',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      await Swal.fire({
        icon : 'error',
        title: 'Save Failed',
        text : err.message ?? 'Could not save your signature. Please try again.',
        confirmButtonColor: '#0818A8'
      });
    } finally {
      this.savingSig = false;
    }
  }

  // ── Print / Download ──────────────────────────────────────────────────────

async printEvaluation() {
  const hasSupervisorSig = !!this.evaluation?.signature_data;
  const hasInternSig     = !!this.evaluation?.intern_signature;

  if (hasSupervisorSig && hasInternSig) {
    await this.downloadAsPDF();
    return;
  }

  if (!hasInternSig) {
    Swal.fire({
      icon              : 'warning',
      title             : 'E-Signature Required',
      html              : `
        <p style="font-size:14px;color:#374151;margin-bottom:6px;">
          Your <strong>e-signature</strong> is required before downloading.
        </p>
        <p style="font-size:12px;color:#6b7280;">
          Please draw or upload your signature in the <strong>Intern Signature</strong> section below, then click <strong>Save Signature</strong>.
        </p>`,
      confirmButtonText : 'Go to Signature',
      confirmButtonColor: '#0818A8',
      showCancelButton  : false,
      didClose: () => {
        setTimeout(() => {
          const sigSection      = document.getElementById('internSigSection');
          const scrollContainer = document.querySelector('.dashboard-content') as HTMLElement;
          if (!sigSection) return;
          if (scrollContainer) {
            const top = sigSection.getBoundingClientRect().top
                      - scrollContainer.getBoundingClientRect().top
                      + scrollContainer.scrollTop - 100;
            scrollContainer.scrollTo({ top, behavior: 'smooth' });
          } else {
            window.scrollTo({ top: sigSection.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
          }
        }, 150);
      }
    });
    return;
  }

  if (!hasSupervisorSig) {
    Swal.fire({
      icon              : 'warning',
      title             : 'Supervisor Signature Missing',
      html              : `<p style="font-size:14px;color:#374151;">The supervisor's e-signature is missing. Please ask your supervisor to re-submit the evaluation with their signature.</p>`,
      confirmButtonText : 'OK',
      confirmButtonColor: '#0818A8',
    });
  }
}

async downloadAsPDF() {
  const element = document.getElementById('printArea');
  if (!element) return;

  // Show loading
  Swal.fire({
    title             : 'Generating PDF...',
    html              : '<p style="font-size:13px;color:#6b7280;">Please wait while your evaluation is being prepared.</p>',
    allowOutsideClick : false,
    showConfirmButton : false,
    didOpen           : () => Swal.showLoading()
  });

  try {
    const canvas = await html2canvas(element, {
      scale          : 2,           // high resolution
      useCORS        : true,
      allowTaint     : true,
      backgroundColor: '#ffffff',
      logging        : false,
      windowWidth    : element.scrollWidth,
      windowHeight   : element.scrollHeight
    });

    const imgData  = canvas.toDataURL('image/png');
    const pdf      = new jsPDF('p', 'mm', 'a4');
    const pageW    = pdf.internal.pageSize.getWidth();
    const pageH    = pdf.internal.pageSize.getHeight();

    // Scale image to fit A4 width, then paginate if taller
    const imgW     = pageW;
    const imgH     = (canvas.height * pageW) / canvas.width;

    let heightLeft = imgH;
    let position   = 0;

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;

    // Additional pages if content is long
    while (heightLeft > 0) {
      position   = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    const fileName = `OJT-Evaluation-${this.student?.student_id ?? 'intern'}.pdf`;
    pdf.save(fileName);

    Swal.fire({
      icon              : 'success',
      title             : 'Downloaded!',
      text              : `Your evaluation has been saved as ${fileName}`,
      confirmButtonColor: '#0818A8',
      timer             : 2500,
      showConfirmButton : false
    });

  } catch (err: any) {
    console.error('PDF generation error:', err);
    Swal.fire({
      icon              : 'error',
      title             : 'Download Failed',
      text              : 'Could not generate PDF. Please try again.',
      confirmButtonColor: '#0818A8'
    });
  }
}
}