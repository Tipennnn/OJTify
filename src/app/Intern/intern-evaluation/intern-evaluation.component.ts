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
  resigning = false;
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

  readonly CRITERIA_KEYS = [
    'punctuality', 'attendance', 'quality_of_work', 'productivity',
    'initiative', 'cooperation', 'communication', 'professionalism', 'dependability'
  ];

  constructor(private appwrite: AppwriteService) {}

 async ngOnInit() { 
  await this.loadData(); 
  await this.loadLogos();
}

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
    (this.evaluation as any).intern_signature = sigData;
    this.resigning = false; // ← add this
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

  Swal.fire({
    title: 'Generating PDF…',
    html: '<p style="font-size:13px;color:#6b7280;">Please wait while your evaluation is being prepared.</p>',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  // ── Hide UI-only elements before capture ────────────────────────────────
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

  // ── Save original styles ─────────────────────────────────────────────────
  const origBoxShadow    = element.style.boxShadow;
  const origBorderRadius = element.style.borderRadius;
  const origWidth        = element.style.width;
  const origMaxWidth     = element.style.maxWidth;
  const origMargin       = element.style.margin;
  const origPadding      = element.style.padding;

  // ── Apply print-friendly overrides ──────────────────────────────────────
  const printStyleEl = document.createElement('style');
  printStyleEl.id = '__pdf-print-overrides';
  printStyleEl.textContent = `
    #printArea {
      width: 794px !important;
      max-width: 794px !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      background: #fff !important;
      font-size: 11px !important;
    }
    #printArea .doc-header {
      background: #0818A8 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #printArea .part-header {
      background: #f0f4ff !important;
      border-left: 4px solid #0818A8 !important;
      page-break-inside: avoid !important;
    }
    #printArea table { page-break-inside: auto !important; }
    #printArea tr    { page-break-inside: avoid !important; page-break-after: auto !important; }
    #printArea .ct-group-header, #printArea .ct-sub-row {
      page-break-inside: avoid !important;
    }
    #printArea .remarks-grid     { page-break-inside: avoid !important; }
    #printArea .sig-row          { page-break-inside: avoid !important; }
    #printArea .recommendation-row { page-break-inside: avoid !important; }
    #printArea .scale-legend-full  { page-break-inside: avoid !important; }
    #printArea .score-circle {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #printArea .bar-fill {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #printArea .rating-tag {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #printArea .rec-active {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  `;
  document.head.appendChild(printStyleEl);

  element.style.boxShadow    = 'none';
  element.style.borderRadius = '0';
  element.style.width        = '794px';
  element.style.maxWidth     = '794px';
  element.style.margin       = '0';

  // Wait for styles to apply
  await new Promise(r => setTimeout(r, 200));

  try {
    const A4_WIDTH_MM  = 210;
    const A4_HEIGHT_MM = 297;
    const DPI          = 150;   // readable quality, smaller file
    const MM_TO_PX     = DPI / 25.4;
    const pageWidthPx  = Math.round(A4_WIDTH_MM  * MM_TO_PX); // ~1240px at 150dpi
    const pageHeightPx = Math.round(A4_HEIGHT_MM * MM_TO_PX); // ~1754px at 150dpi

    // Render the full element
    const canvas = await html2canvas(element, {
      scale          : pageWidthPx / 794,  // scale to exactly A4 width
      useCORS        : true,
      allowTaint     : true,
      backgroundColor: '#ffffff',
      logging        : false,
      width          : 794,
      height         : element.scrollHeight,
      windowWidth    : 794,
    });

    // ── Smart pagination: find safe row-break positions ────────────────────
    const rows = element.querySelectorAll<HTMLElement>(
      'tr.ct-group-header, tr.ct-sub-row, .part-header, .remarks-grid, .sig-row, .recommendation-row, .cert-section, .doc-footer, .scale-legend-full'
    );

    const scaleRatio = canvas.width / 794;   // actual canvas px per CSS px
    const pageHpx    = pageHeightPx;
    const MARGIN_PX  = Math.round(20 * MM_TO_PX); // 20mm top/bottom margin

    // Build list of "avoid-break" blocks (top/bottom in canvas px)
    const blocks: { top: number; bottom: number }[] = [];
    rows.forEach(row => {
      const rect   = row.getBoundingClientRect();
      const elRect = element.getBoundingClientRect();
      const top    = (rect.top - elRect.top) * scaleRatio;
      const bottom = top + rect.height * scaleRatio;
      blocks.push({ top, bottom });
    });

    // Calculate smart page break positions
    const pageBreaks: number[] = [0];
    let currentPageEnd = pageHpx - MARGIN_PX;

    while (currentPageEnd < canvas.height) {
      // Find last block that ENDS before currentPageEnd
      let safeCut = currentPageEnd;
      for (const b of blocks) {
        if (b.bottom <= currentPageEnd && b.bottom > currentPageEnd - pageHpx * 0.3) {
          safeCut = b.bottom;
        }
      }
      // Ensure we don't cut inside a block
      for (const b of blocks) {
        if (b.top < safeCut && b.bottom > safeCut) {
          safeCut = b.top; // push cut before the block
        }
      }
      pageBreaks.push(safeCut);
      currentPageEnd = safeCut + pageHpx - MARGIN_PX;
    }
    pageBreaks.push(canvas.height);

    // ── Build PDF ──────────────────────────────────────────────────────────
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit       : 'mm',
      format     : 'a4',
      compress   : true
    });

    for (let i = 0; i < pageBreaks.length - 1; i++) {
      if (i > 0) pdf.addPage();

      const srcY = pageBreaks[i];
      const srcH = pageBreaks[i + 1] - srcY;
      if (srcH <= 0) continue;

      const slice   = document.createElement('canvas');
      slice.width   = canvas.width;
      slice.height  = srcH;
      const ctx     = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      // Convert canvas px → mm for the PDF image
      const sliceHmm = (srcH / canvas.width) * A4_WIDTH_MM;
      pdf.addImage(
        slice.toDataURL('image/jpeg', 0.82),
        'JPEG', 0, 0,
        A4_WIDTH_MM, sliceHmm,
        undefined, 'FAST'
      );
    }

    const fileName = `OJT-Evaluation-${this.student?.student_id ?? 'intern'}.pdf`;
    pdf.save(fileName);

    Swal.fire({
      icon              : 'success',
      title             : 'Downloaded!',
      text              : `Saved as ${fileName}`,
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
  } finally {
    // Restore all styles
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
startResign() {
  this.resigning    = true;
  this.hasInternSig = false;
  this.signatureMode = 'draw';
  setTimeout(() => {
    this.initCanvas();
    this.clearInternCanvas();
  }, 100);
}
}