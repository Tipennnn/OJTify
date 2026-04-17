import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';
import { ID, Query } from 'appwrite';

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
  dependability: number;           // ← added
  remarks: string;
  strengths?: string;              // ← added
  areas_for_improvement?: string;  // ← added
  recommendation?: 'highly_recommended' | 'recommended' | 'recommended_with_reservations' | 'not_recommended'; // ← added
  signature_data: string;
  evaluated_at: string;
  period_from?: string;            // ← added
  period_to?: string;              // ← added
}

@Component({
  selector: 'app-supervisor-evaluation',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SupervisorSidenavComponent,
    SupervisorTopnavComponent
  ],
  templateUrl: './supervisor-evaluation.component.html',
  styleUrl: './supervisor-evaluation.component.css'
})
export class SupervisorEvaluationComponent implements OnInit {

  students             : Student[] = [];
  filteredStudents     : Student[] = [];
  evaluatedStudents    : Student[] = [];
  filteredEvaluated    : Student[] = [];
  evaluationMap        : Map<string, Evaluation> = new Map();

  loading              = false;
  isCollapsed          = false;
  activeTab            : 'pending' | 'evaluated' = 'pending';
  searchQuery          = '';

  showModal            = false;
  selectedStudent      : Student | null = null;
  submitting           = false;

  currentSupervisor    : any = null;

  isDrawing            = false;
  lastX                = 0;
  lastY                = 0;
  hasSignature         = false;
  signatureMode        : 'draw' | 'upload' = 'draw';
  uploadedFileName     = '';
  private canvas       : HTMLCanvasElement | null = null;
  private ctx          : CanvasRenderingContext2D | null = null;

  currentPage          = 1;
  pageSize             = 10;
  totalPages           = 1;
  pageNumbers          : number[] = [];

  currentPageEval      = 1;
  totalPagesEval       = 1;
  pageNumbersEval      : number[] = [];

  readonly BUCKET_ID   = '69baaf64002ceb2490df';
  readonly PROJECT_ID  = '69ba8d9c0027d10c447f';
  readonly ENDPOINT    = 'https://sgp.cloud.appwrite.io/v1';
  readonly EVAL_COL    = 'evaluations';
  readonly REQUIRED_HOURS = 500;

  evaluation: Evaluation = this.freshEval();

  // ── All 9 criteria keys (used in validation, averages, etc.) ────────────────
  private readonly EVAL_KEYS = [
    'punctuality', 'attendance', 'quality_of_work', 'productivity',
    'initiative', 'cooperation', 'communication', 'professionalism', 'dependability'
  ];

  readonly CRITERIA = [
    { key: 'punctuality',     label: 'Punctuality',            icon: 'fa-clock',           question: 'Does the trainee arrive on time and follow the assigned schedule?' },
    { key: 'attendance',      label: 'Attendance',             icon: 'fa-calendar-check',  question: 'Does the trainee maintain consistent attendance and avoid unnecessary absences?' },
    { key: 'quality_of_work', label: 'Quality of Work',        icon: 'fa-medal',           question: 'Does the trainee complete tasks accurately and with attention to detail?' },
    { key: 'productivity',    label: 'Productivity',           icon: 'fa-chart-line',      question: 'Does the trainee complete assigned tasks efficiently and on time?' },
    { key: 'initiative',      label: 'Initiative',             icon: 'fa-bolt',            question: 'Does the trainee show willingness to take responsibility and perform tasks without being told?' },
    { key: 'cooperation',     label: 'Cooperation / Teamwork', icon: 'fa-handshake',       question: 'Does the trainee work well with others and maintain good relationships?' },
    { key: 'communication',   label: 'Communication Skills',   icon: 'fa-comments',        question: 'Does the trainee communicate clearly and professionally with staff and supervisors?' },
    { key: 'professionalism', label: 'Professionalism',        icon: 'fa-user-tie',        question: 'Does the trainee demonstrate proper behavior, attitude, and respect in the workplace?' },
    { key: 'dependability',   label: 'Dependability',          icon: 'fa-shield-halved',   question: 'Can the trainee be trusted with tasks and does the trainee follow through on commitments and take responsibility for mistakes?' }
  ];

  readonly RECOMMENDATIONS = [
    { value: 'highly_recommended',            label: 'Highly Recommended' },
    { value: 'recommended',                   label: 'Recommended' },
    { value: 'recommended_with_reservations', label: 'With Reservations' },
    { value: 'not_recommended',               label: 'Not Recommended' }
  ];

  readonly RATING_LABELS: Record<number, string> = {
    1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent'
  };

  constructor(private appwrite: AppwriteService, private router: Router) {}

  async ngOnInit() {
    await this.loadCurrentSupervisor();
    await this.loadData();
  }

  // ── Load logged-in supervisor ──────────────────────────────────────────────

  async loadCurrentSupervisor() {
    try {
      const account = await this.appwrite.account.get();
      const res     = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL,
        [Query.equal('email', account.email)]
      );
      this.currentSupervisor = res.documents[0] ?? {
        $id       : account.$id,
        first_name: account.name?.split(' ')[0] ?? '',
        last_name : account.name?.split(' ').slice(1).join(' ') ?? '',
        email     : account.email
      };
    } catch (err: any) {
      console.warn('Could not load supervisor:', err.message);
      this.currentSupervisor = null;
    }
  }

  get supervisorFullName(): string {
    if (!this.currentSupervisor) return 'Unknown Supervisor';
    return `${this.currentSupervisor.first_name ?? ''} ${this.currentSupervisor.last_name ?? ''}`.trim();
  }

  // ── Fresh blank evaluation ─────────────────────────────────────────────────

  freshEval(): Evaluation {
    return {
      student_id_ref        : '',
      supervisor_id         : '',
      supervisor_name       : '',
      punctuality           : 0,
      attendance            : 0,
      quality_of_work       : 0,
      productivity          : 0,
      initiative            : 0,
      cooperation           : 0,
      communication         : 0,
      professionalism       : 0,
      dependability         : 0,
      remarks               : '',
      strengths             : '',
      areas_for_improvement : '',
      recommendation        : undefined,
      signature_data        : '',
      evaluated_at          : '',
      period_from           : '',
      period_to             : ''
    };
  }

  // ── Load students + existing evaluations ──────────────────────────────────

  async loadData() {
    this.loading = true;
    try {
      const [studentsRes, evalsRes] = await Promise.all([
        this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL),
        this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.EVAL_COL)
      ]);

      (evalsRes.documents as any[]).forEach(e => this.evaluationMap.set(e.student_id_ref, e as Evaluation));

      const all = (studentsRes.documents as any[]).filter(
        s => (s.completed_hours || 0) >= (s.required_hours || this.REQUIRED_HOURS)
      );
      this.students          = all.filter(s => !this.evaluationMap.has(s.$id));
      this.evaluatedStudents = all.filter(s =>  this.evaluationMap.has(s.$id));

    } catch (err: any) {
      console.error('Failed to load evaluation data:', err.message);
    } finally {
      this.filteredStudents  = [...this.students];
      this.filteredEvaluated = [...this.evaluatedStudents];
      this.updatePagination();
      this.updatePaginationEval();
      this.loading = false;
    }
  }

  // ── Tabs & Search ──────────────────────────────────────────────────────────

  setTab(tab: 'pending' | 'evaluated') {
    this.activeTab    = tab;
    this.searchQuery  = '';
    this.filteredStudents  = [...this.students];
    this.filteredEvaluated = [...this.evaluatedStudents];
    this.currentPage = 1; this.currentPageEval = 1;
    this.updatePagination(); this.updatePaginationEval();
  }

  onSearch(event: any) {
    const q = event.target.value.toLowerCase();
    this.searchQuery = q;
    const match = (s: Student) =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      s.student_id.toLowerCase().includes(q) ||
      s.course.toLowerCase().includes(q);

    if (this.activeTab === 'pending') {
      this.filteredStudents = this.students.filter(match);
      this.currentPage = 1; this.updatePagination();
    } else {
      this.filteredEvaluated = this.evaluatedStudents.filter(match);
      this.currentPageEval = 1; this.updatePaginationEval();
    }
  }

  // ── Pagination ─────────────────────────────────────────────────────────────

  updatePagination()     { this.totalPages     = Math.max(1, Math.ceil(this.filteredStudents.length  / this.pageSize)); this.pageNumbers     = Array.from({ length: this.totalPages     }, (_, i) => i + 1); }
  updatePaginationEval() { this.totalPagesEval = Math.max(1, Math.ceil(this.filteredEvaluated.length / this.pageSize)); this.pageNumbersEval = Array.from({ length: this.totalPagesEval }, (_, i) => i + 1); }

  get pagedStudents()  { const s = (this.currentPage     - 1) * this.pageSize; return this.filteredStudents.slice(s, s  + this.pageSize); }
  get pagedEvaluated() { const s = (this.currentPageEval - 1) * this.pageSize; return this.filteredEvaluated.slice(s, s + this.pageSize); }

  goToPage(p: number)     { this.currentPage     = p; }
  prevPage()              { if (this.currentPage > 1)                this.currentPage--; }
  nextPage()              { if (this.currentPage < this.totalPages)  this.currentPage++; }
  goToPageEval(p: number) { this.currentPageEval = p; }
  prevPageEval()          { if (this.currentPageEval > 1)                  this.currentPageEval--; }
  nextPageEval()          { if (this.currentPageEval < this.totalPagesEval) this.currentPageEval++; }

  // ── Modal open / close ─────────────────────────────────────────────────────

  openEvaluate(student: Student) {
    this.selectedStudent  = student;
    this.evaluation       = { ...this.freshEval(), student_id_ref: student.$id };
    this.hasSignature     = false;
    this.signatureMode    = 'draw';
    this.uploadedFileName = '';
    this.showModal        = true;
    setTimeout(() => this.initCanvas(), 150);
  }

  viewEvaluation(student: Student) {
    const ev = this.evaluationMap.get(student.$id);
    if (!ev) return;
    this.selectedStudent  = student;
    this.evaluation       = { ...ev };
    this.hasSignature     = !!ev.signature_data;
    this.signatureMode    = 'draw';
    this.showModal        = true;
    setTimeout(() => {
      this.initCanvas();
      if (ev.signature_data && this.ctx && this.canvas) {
        const img = new Image();
        img.onload = () => this.ctx!.drawImage(img, 0, 0);
        img.src    = ev.signature_data;
      }
    }, 150);
  }

  closeModal() {
    this.showModal = false; this.selectedStudent = null;
    this.clearCanvas(); this.uploadedFileName = '';
  }

  isViewMode(): boolean {
    return !!this.selectedStudent && this.evaluationMap.has(this.selectedStudent.$id);
  }

  // ── Ratings ────────────────────────────────────────────────────────────────

  setRating(criterion: string, value: number) {
    if (this.isViewMode()) return;
    (this.evaluation as any)[criterion] = value;
  }

  getRating(criterion: string): number {
    return (this.evaluation as any)[criterion] || 0;
  }

  getRatingLabelForValue(value: number): string {
    return this.RATING_LABELS[value] || '';
  }

  getRatingColor(value: number): string {
    if (value === 5) return '#059669'; if (value === 4) return '#2563eb';
    if (value === 3) return '#d97706'; if (value === 2) return '#ea580c';
    if (value === 1) return '#dc2626'; return '#9ca3af';
  }

  // ── Recommendation ─────────────────────────────────────────────────────────

  setRecommendation(value: string) {
    if (this.isViewMode()) return;
    this.evaluation.recommendation = value as any;
  }

  /** Auto-derive recommendation from average if supervisor didn't pick one */
  private autoRecommendation(): void {
    const avg = this.getOverallAverage();
    if      (avg >= 4.5) this.evaluation.recommendation = 'highly_recommended';
    else if (avg >= 3.5) this.evaluation.recommendation = 'recommended';
    else if (avg >= 2.5) this.evaluation.recommendation = 'recommended_with_reservations';
    else if (avg  >  0)  this.evaluation.recommendation = 'not_recommended';
  }

  getRecommendationLabel(rec?: string): string {
    return this.RECOMMENDATIONS.find(r => r.value === rec)?.label ?? '—';
  }

  // ── Averages & labels ──────────────────────────────────────────────────────

  getOverallAverage(): number {
    const filled = this.EVAL_KEYS
      .map(k => (this.evaluation as any)[k])
      .filter((v: number) => v > 0);
    if (!filled.length) return 0;
    return parseFloat((filled.reduce((a: number, b: number) => a + b, 0) / filled.length).toFixed(2));
  }

  getOverallLabel(avg: number): string {
    if (avg >= 4.5) return 'Excellent'; if (avg >= 3.5) return 'Very Good';
    if (avg >= 2.5) return 'Good';      if (avg >= 1.5) return 'Fair';
    if (avg  >  0)  return 'Poor';      return '';
  }

  getOverallColor(avg: number): string {
    if (avg >= 4.5) return '#059669'; if (avg >= 3.5) return '#2563eb';
    if (avg >= 2.5) return '#d97706'; if (avg >= 1.5) return '#ea580c';
    return '#dc2626';
  }

  // ── Form validation ────────────────────────────────────────────────────────

  isFormValid(): boolean {
    const allRated       = this.EVAL_KEYS.every(k => (this.evaluation as any)[k] > 0);
    const hasRec         = !!this.evaluation.recommendation;
    return allRated && hasRec && this.hasSignature;
  }

  // ── Signature canvas ───────────────────────────────────────────────────────

  setSignatureMode(mode: 'draw' | 'upload') {
    if (this.isViewMode()) return;
    this.signatureMode    = mode;
    this.hasSignature     = false;
    this.uploadedFileName = '';
    if (mode === 'draw') { setTimeout(() => { this.initCanvas(); this.clearCanvas(); }, 50); }
  }

  initCanvas() {
    this.canvas = document.getElementById('sigCanvas') as HTMLCanvasElement;
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
    if (this.isViewMode()) return;
    this.isDrawing = true;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    this.lastX = (e.clientX - rect.left) * (this.canvas!.width  / rect.width);
    this.lastY = (e.clientY - rect.top)  * (this.canvas!.height / rect.height);
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isDrawing || !this.ctx || this.isViewMode()) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x    = (e.clientX - rect.left) * (this.canvas!.width  / rect.width);
    const y    = (e.clientY - rect.top)  * (this.canvas!.height / rect.height);
    this.ctx.beginPath(); this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y); this.ctx.stroke();
    this.lastX = x; this.lastY = y; this.hasSignature = true;
  }

  onMouseUp()    { this.isDrawing = false; }
  onMouseLeave() { this.isDrawing = false; }

  onTouchStart(e: TouchEvent) {
    if (this.isViewMode()) return; e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const t    = e.touches[0];
    this.lastX = (t.clientX - rect.left) * (this.canvas!.width  / rect.width);
    this.lastY = (t.clientY - rect.top)  * (this.canvas!.height / rect.height);
    this.isDrawing = true;
  }

  onTouchMove(e: TouchEvent) {
    if (!this.isDrawing || !this.ctx || this.isViewMode()) return; e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const t    = e.touches[0];
    const x    = (t.clientX - rect.left) * (this.canvas!.width  / rect.width);
    const y    = (t.clientY - rect.top)  * (this.canvas!.height / rect.height);
    this.ctx.beginPath(); this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y); this.ctx.stroke();
    this.lastX = x; this.lastY = y; this.hasSignature = true;
  }

  onTouchEnd() { this.isDrawing = false; }

  clearCanvas() {
    if (this.ctx && this.canvas) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasSignature = false;
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
        this.hasSignature = true;
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  triggerFileInput() {
    const el = document.getElementById('sigFileInput') as HTMLInputElement;
    if (el) el.click();
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async submitEvaluation() {
    if (!this.isFormValid() || !this.selectedStudent) return;

    // Fallback: auto-derive recommendation if somehow still missing
    if (!this.evaluation.recommendation) this.autoRecommendation();

    this.submitting = true;
    try {
      const sigData = this.canvas ? this.canvas.toDataURL('image/png') : '';

      // Convert "YYYY-MM-DD" date-input values → ISO strings for Appwrite datetime columns
      const toISO = (d?: string): string | null =>
        d ? new Date(d).toISOString() : null;

      const payload = {
        student_id_ref        : this.selectedStudent.$id,
        supervisor_id         : this.currentSupervisor?.$id ?? null,
        supervisor_name       : this.supervisorFullName,
        punctuality           : this.evaluation.punctuality,
        attendance            : this.evaluation.attendance,
        quality_of_work       : this.evaluation.quality_of_work,
        productivity          : this.evaluation.productivity,
        initiative            : this.evaluation.initiative,
        cooperation           : this.evaluation.cooperation,
        communication         : this.evaluation.communication,
        professionalism       : this.evaluation.professionalism,
        dependability         : this.evaluation.dependability,
        remarks               : this.evaluation.remarks               || '',
        strengths             : this.evaluation.strengths             || '',
        areas_for_improvement : this.evaluation.areas_for_improvement || '',
        recommendation        : this.evaluation.recommendation        ?? null,
        signature_data        : sigData,
        evaluated_at          : new Date().toISOString(),
        period_from           : toISO(this.evaluation.period_from),
        period_to             : toISO(this.evaluation.period_to)
      };

      await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.EVAL_COL,
        ID.unique(),
        payload
      );

      this.evaluationMap.set(this.selectedStudent.$id, payload as any);
      this.students          = this.students.filter(s => s.$id !== this.selectedStudent!.$id);
      this.evaluatedStudents = [this.selectedStudent!, ...this.evaluatedStudents];
      this.filteredStudents  = [...this.students];
      this.filteredEvaluated = [...this.evaluatedStudents];
      this.updatePagination();
      this.updatePaginationEval();
      this.closeModal();

    } catch (err: any) {
      console.error('Submit evaluation error:', err.message);
      alert('Failed to submit evaluation: ' + err.message);
    } finally {
      this.submitting = false;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  onToggleSidebar(c: boolean) { this.isCollapsed = c; }

  getFullName(s: Student): string {
    return `${s.first_name}${s.middle_name ? ' ' + s.middle_name : ''} ${s.last_name}`;
  }

  getAvatarUrl(student: Student): string {
    if (student.profile_photo_id)
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${student.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(student.first_name + ' ' + student.last_name)}&background=0818A8&color=fff&size=64`;
  }

  getProgress(s: Student): number {
    return Math.min(parseFloat((((s.completed_hours || 0) / (s.required_hours || 500)) * 100).toFixed(1)), 100);
  }

  getEvalDate(s: Student): string {
    const ev = this.evaluationMap.get(s.$id);
    if (!ev?.evaluated_at) return '—';
    return new Date(ev.evaluated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  getEvalAverage(s: Student): number {
    const ev = this.evaluationMap.get(s.$id);
    if (!ev) return 0;
    const filled = this.EVAL_KEYS
      .map(k => (ev as any)[k] || 0)
      .filter((v: number) => v > 0);
    if (!filled.length) return 0;
    return parseFloat((filled.reduce((a: number, b: number) => a + b, 0) / filled.length).toFixed(2));
  }
}