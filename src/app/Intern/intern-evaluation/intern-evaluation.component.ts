import { Component, OnInit } from '@angular/core';
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
  scores_json: string;           // JSON: { [criterionKey]: number }
  criteria_snapshot: string;     // JSON: EditableCriterion[]
  remarks: string;
  strengths?: string;
  areas_for_improvement?: string;
  recommendation?: 'highly_recommended' | 'recommended' | 'recommended_with_reservations' | 'not_recommended';
  signature_data: string;
  intern_signature?: string;
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

/** One criterion as stored in the snapshot */
export interface StoredCriterion {
  key: string;
  label: string;
  icon: string;
  question: string;
  numChoices: number;
  choiceLabels: Record<number, string>;
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

  /** Criteria rebuilt from the evaluation's criteria_snapshot */
  displayCriteria: StoredCriterion[] = [];
  /** Scores keyed by criterion key */
  scores: Record<string, number> = {};

  // ── Intern signature ─────────────────────────────────────────────────────
  isDrawing        = false;
  lastX            = 0;
  lastY            = 0;
  hasInternSig     = false;
  signatureMode    : 'draw' | 'upload' = 'draw';
  resigning        = false;
  uploadedFileName = '';
  savingSig        = false;
  private canvas   : HTMLCanvasElement | null = null;
  private ctx      : CanvasRenderingContext2D | null = null;

  depedLogoB64  = '';
  ocesLogoB64   = '';
  ojtifyLogoB64 = '';

  private readonly DEPED_LOGO_ID  = '69e3617400102e6fd08e';
  private readonly OCES_LOGO_ID   = '69e3617e00298107dd82';
  private readonly OJTIFY_LOGO_ID = '69e35cb600237a0da105';

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';
  readonly EVAL_COL   = 'evaluations';
  readonly SUP_COL    = 'supervisors';
  readonly SCHOOL     = 'Olongapo City Elementary School';
  readonly AY         = 'A.Y. 2024 – 2025';

  /** Fallback criteria if snapshot is missing */
  private readonly DEFAULT_CRITERIA: StoredCriterion[] = [
    { key: 'punctuality',     label: 'Punctuality',            icon: 'fa-clock',          numChoices: 5, question: 'Does the trainee arrive on time and follow the assigned schedule?',               choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent' } },
    { key: 'attendance',      label: 'Attendance',             icon: 'fa-calendar-check', numChoices: 5, question: 'Does the trainee maintain consistent attendance and avoid unnecessary absences?',  choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent' } },
    { key: 'quality_of_work', label: 'Quality of Work',        icon: 'fa-medal',          numChoices: 5, question: 'Does the trainee complete tasks accurately and with attention to detail?',        choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent' } },
    { key: 'productivity',    label: 'Productivity',           icon: 'fa-chart-line',     numChoices: 5, question: 'Does the trainee complete assigned tasks efficiently and on time?',               choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent' } },
    { key: 'initiative',      label: 'Initiative',             icon: 'fa-bolt',           numChoices: 5, question: 'Does the trainee show willingness to take responsibility?',                       choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent' } },
    { key: 'cooperation',     label: 'Cooperation / Teamwork', icon: 'fa-handshake',      numChoices: 5, question: 'Does the trainee work well with others?',                                        choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent' } },
    { key: 'communication',   label: 'Communication Skills',   icon: 'fa-comments',       numChoices: 5, question: 'Does the trainee communicate clearly and professionally?',                       choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent' } },
    { key: 'professionalism', label: 'Professionalism',        icon: 'fa-user-tie',       numChoices: 5, question: 'Does the trainee demonstrate proper behavior and respect?',                      choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent' } },
    { key: 'dependability',   label: 'Dependability',          icon: 'fa-shield-halved',  numChoices: 5, question: 'Can the trainee be trusted with tasks and commitments?',                         choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent' } }
  ];

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadData();
    await this.loadLogos();
  }

  // ── Load data ─────────────────────────────────────────────────────────────
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
      this.student = (sRes.documents as any[]).find(s => s.email === account.email) ?? null;
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
    const ev = (eRes.documents as any[]).find(e => e.student_id_ref === this.student!.$id);

    if (ev) {
      this.evaluation    = ev as Evaluation;
      this.hasEvaluation = true;
      this.hasInternSig  = !!ev.intern_signature;

      // ── Rebuild display criteria from snapshot ──────────────────
      let criteriaSnap: any[] = [];
      try {
        criteriaSnap = JSON.parse(ev.criteria_snapshot ?? '[]');
      } catch { criteriaSnap = []; }

      if (criteriaSnap.length) {
        // Convert EditableCriterion[] (supervisor format) → StoredCriterion[]
        // Each EditableCriterion has multiple questions; flatten to one row per question
        this.displayCriteria = [];
        for (const c of criteriaSnap) {
          if (c.questions?.length) {
            for (const q of c.questions) {
              this.displayCriteria.push({
                key         : `${c.key}::${q.qkey}`,  // matches answers_json key
                label       : c.label,
                icon        : c.icon ?? 'fa-star',
                question    : q.text,
                numChoices  : q.numChoices ?? 5,
                choiceLabels: q.choiceLabels ?? { 1:'Poor', 2:'Fair', 3:'Good', 4:'V.Good', 5:'Excellent' }
              });
            }
          } else {
            // Old flat format fallback
            this.displayCriteria.push({
              key         : c.key,
              label       : c.label,
              icon        : c.icon ?? 'fa-star',
              question    : c.question ?? c.label,
              numChoices  : c.numChoices ?? 5,
              choiceLabels: c.choiceLabels ?? { 1:'Poor', 2:'Fair', 3:'Good', 4:'V.Good', 5:'Excellent' }
            });
          }
        }
      } else {
        this.displayCriteria = this.DEFAULT_CRITERIA;
      }

      // ── Parse scores from answers_json (supervisor format) ──────
      try {
        const raw = JSON.parse(ev.answers_json ?? '{}');
        // answers_json keys are like "punctuality::q1" → value is a string number
        this.scores = {};
        for (const [key, val] of Object.entries(raw)) {
          this.scores[key] = parseInt(val as string, 10) || 0;
        }
      } catch {
        // Fallback to legacy flat fields
        this.scores = this.legacyScores(ev);
      }

      // ── Parse remarks from remarks_sections_json ─────────────────
      try {
        const remarksMap = JSON.parse(ev.remarks_sections_json ?? '{}');
        // Map to the flat fields the template uses
        if (!ev.strengths)             (this.evaluation as any).strengths             = remarksMap['strengths']             ?? '';
        if (!ev.areas_for_improvement) (this.evaluation as any).areas_for_improvement = remarksMap['areas_for_improvement'] ?? '';
        if (!ev.remarks)               (this.evaluation as any).remarks               = remarksMap['overall_remarks']        ?? '';
      } catch {}

      // ── Load supervisor ──────────────────────────────────────────
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

  /** Backward-compat: extract scores from old flat fields */
  private legacyScores(ev: any): Record<string, number> {
    const keys = ['punctuality','attendance','quality_of_work','productivity','initiative','cooperation','communication','professionalism','dependability'];
    const out: Record<string, number> = {};
    for (const k of keys) if (ev[k]) out[k] = ev[k];
    return out;
  }

  async loadLogos() {
    const toBase64 = (fileId: string): Promise<string> =>
      fetch(`${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=${this.PROJECT_ID}`)
        .then(r => r.blob())
        .then(blob => new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload  = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        }));

    [this.depedLogoB64, this.ocesLogoB64, this.ojtifyLogoB64] = await Promise.all([
      toBase64(this.DEPED_LOGO_ID).catch(() => ''),
      toBase64(this.OCES_LOGO_ID).catch(() => ''),
      toBase64(this.OJTIFY_LOGO_ID).catch(() => '')
    ]);
  }

  private buildSupervisorFromName(ev: any) {
    const parts = (ev.supervisor_name ?? '').split(' ');
    this.supervisor = {
      $id         : ev.supervisor_id ?? '',
      first_name  : parts[0] ?? 'Supervisor',
      last_name   : parts.slice(1).join(' ') ?? '',
      position    : ev.supervisor_position   ?? undefined,
      company_name: ev.supervisor_company    ?? undefined,
      department  : ev.supervisor_department ?? undefined,
      email       : ev.supervisor_email      ?? undefined
    };
  }

  // ── Rating helpers ────────────────────────────────────────────────────────
  getRating(key: string): number {
  return this.scores[key] ?? 0;
}
  getChoiceLabel(c: StoredCriterion, v: number): string {
    return c.choiceLabels?.[v] ?? `Level ${v}`;
  }

  getRatingColor(value: number, max: number = 5): string {
    const ratio = max > 1 ? (value - 1) / (max - 1) : 1;
    if (ratio >= 0.9)  return '#059669';
    if (ratio >= 0.65) return '#2563eb';
    if (ratio >= 0.45) return '#d97706';
    if (ratio >= 0.25) return '#ea580c';
    return '#dc2626';
  }

  get ratingLegendItems(): { v: number; l: string }[] {
    if (!this.displayCriteria.length) return [];
    const c = this.displayCriteria[0];
    const n = c.numChoices;
    return Array.from({ length: n }, (_, i) => n - i).map(v => ({
      v, l: c.choiceLabels[v] ?? `Level ${v}`
    }));
  }

  choiceRange(c: StoredCriterion): number[] {
    return Array.from({ length: c.numChoices }, (_, i) => i + 1);
  }

  getOverallAverage(): number {
  if (!this.displayCriteria.length) return 0;
  const normalized = this.displayCriteria
    .map(c => {
      const raw = this.scores[c.key] ?? 0;
      return raw > 0 ? (raw / c.numChoices) * 5 : 0;
    })
    .filter(v => v > 0);
  if (!normalized.length) return 0;
  return parseFloat((normalized.reduce((a, b) => a + b, 0) / normalized.length).toFixed(2));
}

  getOverallLabel(avg: number): string {
    if (avg >= 4.5) return 'Excellent';
    if (avg >= 3.5) return 'Very Good';
    if (avg >= 2.5) return 'Good';
    if (avg >= 1.5) return 'Fair';
    return avg > 0 ? 'Poor' : '';
  }

  isRecommendationActive(value: string): boolean {
    if (this.evaluation?.recommendation) return this.evaluation.recommendation === value;
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
    if (this.hasInternSig && this.evaluation?.intern_signature) return;
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
    this.ctx.beginPath(); this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y); this.ctx.stroke();
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
    this.ctx.beginPath(); this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y); this.ctx.stroke();
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
      (this.evaluation as any).intern_signature = sigData;
      this.resigning = false;
      await Swal.fire({
        icon: 'success', title: 'Signature Saved!',
        text: 'Your e-signature has been updated successfully.',
        confirmButtonColor: '#0818A8',
        timer: 2000, showConfirmButton: false
      });
    } catch (err: any) {
      await Swal.fire({
        icon: 'error', title: 'Save Failed',
        text: err.message ?? 'Could not save your signature. Please try again.',
        confirmButtonColor: '#0818A8'
      });
    } finally {
      this.savingSig = false;
    }
  }

  startResign() {
    this.resigning     = true;
    this.hasInternSig  = false;
    this.signatureMode = 'draw';
    setTimeout(() => { this.initCanvas(); this.clearInternCanvas(); }, 100);
  }

  // ── Print / Download ──────────────────────────────────────────────────────
  async printEvaluation() {
    const hasSupervisorSig = !!this.evaluation?.signature_data;
    const hasInternSig     = !!this.evaluation?.intern_signature;

    if (hasSupervisorSig && hasInternSig) { await this.downloadAsPDF(); return; }

    if (!hasInternSig) {
      Swal.fire({
        icon: 'warning', title: 'E-Signature Required',
        html: `<p style="font-size:14px;color:#374151;margin-bottom:6px;">Your <strong>e-signature</strong> is required before downloading.</p><p style="font-size:12px;color:#6b7280;">Please draw or upload your signature in the <strong>Intern Signature</strong> section below, then click <strong>Save Signature</strong>.</p>`,
        confirmButtonText: 'Go to Signature', confirmButtonColor: '#0818A8', showCancelButton: false,
        didClose: () => {
          setTimeout(() => {
            const sigSection      = document.getElementById('internSigSection');
            const scrollContainer = document.querySelector('.dashboard-content') as HTMLElement;
            if (!sigSection) return;
            if (scrollContainer) {
              const top = sigSection.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop - 100;
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
        icon: 'warning', title: 'Supervisor Signature Missing',
        html: `<p style="font-size:14px;color:#374151;">The supervisor's e-signature is missing. Please ask your supervisor to re-submit the evaluation with their signature.</p>`,
        confirmButtonText: 'OK', confirmButtonColor: '#0818A8'
      });
    }
  }

  async downloadAsPDF() {
    const element = document.getElementById('printArea');
    if (!element) return;

    Swal.fire({
      title: 'Generating PDF…',
      html: '<p style="font-size:13px;color:#6b7280;">Please wait while your evaluation is being prepared.</p>',
      allowOutsideClick: false, showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    const hiddenEls: { el: HTMLElement; prev: string }[] = [];
    const hide = (selector: string) => {
      document.querySelectorAll<HTMLElement>(selector).forEach(el => {
        hiddenEls.push({ el, prev: el.style.display });
        el.style.display = 'none';
      });
    };
    hide('app-intern-sidenav');
    hide('app-intern-topnav');
    hide('.dashboard-header');
    hide('.no-print');
    hide('.intern-sig-pad-wrap');
    hide('#internSigSection');
    hide('.clear-btn-sm');

    const origBoxShadow    = element.style.boxShadow;
    const origBorderRadius = element.style.borderRadius;
    const origWidth        = element.style.width;
    const origMaxWidth     = element.style.maxWidth;
    const origMargin       = element.style.margin;
    const origPadding      = element.style.padding;

    const printStyleEl = document.createElement('style');
    printStyleEl.id = '__pdf-print-overrides';
    printStyleEl.textContent = `
      #printArea { width: 794px !important; max-width: 794px !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border-radius: 0 !important; background: #fff !important; font-size: 11px !important; }
      #printArea .doc-header { background: #0818A8 !important; -webkit-print-color-adjust: exact !important; }
      #printArea .criteria-table thead { background: #0818A8 !important; -webkit-print-color-adjust: exact !important; }
      #printArea .ct-overall { background: #f0f3ff !important; -webkit-print-color-adjust: exact !important; }
      #printArea .ct-group-header { background: #eef0f8 !important; -webkit-print-color-adjust: exact !important; }
      #printArea .rec-active { background: #e8eaf8 !important; -webkit-print-color-adjust: exact !important; }
      #printArea .score-circle, #printArea .bar-fill, #printArea .rating-tag, #printArea .remarks-section, #printArea .cert-statement, #printArea .remarks-box { -webkit-print-color-adjust: exact !important; }
    `;
    document.head.appendChild(printStyleEl);
    element.style.boxShadow = 'none'; element.style.borderRadius = '0';
    element.style.width = '794px'; element.style.maxWidth = '794px'; element.style.margin = '0';

    await new Promise(r => setTimeout(r, 200));

    try {
      const A4_WIDTH_MM  = 210;
      const A4_HEIGHT_MM = 297;
      const DPI          = 150;
      const MM_TO_PX     = DPI / 25.4;
      const pageWidthPx  = Math.round(A4_WIDTH_MM  * MM_TO_PX);
      const pageHeightPx = Math.round(A4_HEIGHT_MM * MM_TO_PX);

      const canvas = await html2canvas(element, {
        scale: pageWidthPx / 794, useCORS: true, allowTaint: true,
        backgroundColor: '#ffffff', logging: false,
        width: 794, height: element.scrollHeight, windowWidth: 794
      });

      const rows = element.querySelectorAll<HTMLElement>(
        'tr.ct-group-header, tr.ct-sub-row, .part-header, .remarks-grid, .sig-row, .recommendation-row, .cert-section, .doc-footer, .scale-legend-full'
      );
      const scaleRatio = canvas.width / 794;
      const MARGIN_PX  = Math.round(20 * MM_TO_PX);
      const blocks: { top: number; bottom: number }[] = [];
      rows.forEach(row => {
        const rect   = row.getBoundingClientRect();
        const elRect = element.getBoundingClientRect();
        const top    = (rect.top - elRect.top) * scaleRatio;
        blocks.push({ top, bottom: top + rect.height * scaleRatio });
      });

      const pageBreaks: number[] = [0];
      let currentPageEnd = pageHeightPx - MARGIN_PX;
      while (currentPageEnd < canvas.height) {
        let safeCut = currentPageEnd;
        for (const b of blocks) {
          if (b.bottom <= currentPageEnd && b.bottom > currentPageEnd - pageHeightPx * 0.3) safeCut = b.bottom;
        }
        for (const b of blocks) {
          if (b.top < safeCut && b.bottom > safeCut) safeCut = b.top;
        }
        pageBreaks.push(safeCut);
        currentPageEnd = safeCut + pageHeightPx - MARGIN_PX;
      }
      pageBreaks.push(canvas.height);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (let i = 0; i < pageBreaks.length - 1; i++) {
        if (i > 0) pdf.addPage();
        const srcY = pageBreaks[i], srcH = pageBreaks[i + 1] - srcY;
        if (srcH <= 0) continue;
        const slice   = document.createElement('canvas');
        slice.width   = canvas.width; slice.height = srcH;
        const ctx     = slice.getContext('2d')!;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        const sliceHmm = (srcH / canvas.width) * A4_WIDTH_MM;
        pdf.addImage(slice.toDataURL('image/jpeg', 0.82), 'JPEG', 0, 0, A4_WIDTH_MM, sliceHmm, undefined, 'FAST');
      }

      const fileName = `OJT-Evaluation-${this.student?.student_id ?? 'intern'}.pdf`;
      pdf.save(fileName);
      Swal.fire({ icon: 'success', title: 'Downloaded!', text: `Saved as ${fileName}`, confirmButtonColor: '#0818A8', timer: 2500, showConfirmButton: false });

    } catch (err: any) {
      console.error('PDF generation error:', err);
      Swal.fire({ icon: 'error', title: 'Download Failed', text: 'Could not generate PDF. Please try again.', confirmButtonColor: '#0818A8' });
    } finally {
      for (const { el, prev } of hiddenEls) { el.style.display = prev; }
      element.style.boxShadow    = origBoxShadow;
      element.style.borderRadius = origBorderRadius;
      element.style.width        = origWidth;
      element.style.maxWidth     = origMaxWidth;
      element.style.margin       = origMargin;
      element.style.padding      = origPadding;
      document.getElementById('__pdf-print-overrides')?.remove();
    }
  }
}