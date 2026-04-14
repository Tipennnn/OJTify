import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';

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
  remarks: string;
  signature_data: string;
  evaluated_at: string;
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

  readonly CRITERIA = [
    { key: 'punctuality',     label: 'Punctuality',           icon: 'fa-clock',          question: 'Does the trainee arrive on time and follow the assigned schedule?' },
    { key: 'attendance',      label: 'Attendance',            icon: 'fa-calendar-check', question: 'Does the trainee maintain consistent attendance and avoid unnecessary absences?' },
    { key: 'quality_of_work', label: 'Quality of Work',       icon: 'fa-medal',          question: 'Does the trainee complete tasks accurately and with attention to detail?' },
    { key: 'productivity',    label: 'Productivity',          icon: 'fa-chart-line',     question: 'Does the trainee complete assigned tasks efficiently and on time?' },
    { key: 'initiative',      label: 'Initiative',            icon: 'fa-bolt',           question: 'Does the trainee show willingness to take responsibility and perform tasks without being told?' },
    { key: 'cooperation',     label: 'Cooperation / Teamwork',icon: 'fa-handshake',      question: 'Does the trainee work well with others and maintain good relationships?' },
    { key: 'communication',   label: 'Communication Skills',  icon: 'fa-comments',       question: 'Does the trainee communicate clearly and professionally with staff and supervisors?' },
    { key: 'professionalism', label: 'Professionalism',       icon: 'fa-user-tie',       question: 'Does the trainee demonstrate proper behavior, attitude, and respect in the workplace?' }
  ];

  readonly RATING_LABELS: Record<number, string> = {
    1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V. Good', 5: 'Excellent'
  };

  private readonly DUMMY_STUDENTS: Student[] = [
    { $id: 'dummy1', first_name: 'Juan', middle_name: 'Santos', last_name: 'Dela Cruz', student_id: '2021-00123', course: 'BSIT', school_name: 'PLM', email: 'juan@email.com', required_hours: 500, completed_hours: 500, $createdAt: '2024-06-01T00:00:00.000Z' },
    { $id: 'dummy2', first_name: 'Maria', middle_name: '', last_name: 'Reyes', student_id: '2021-00456', course: 'BSCS', school_name: 'PLM', email: 'maria@email.com', required_hours: 500, completed_hours: 500, $createdAt: '2024-06-01T00:00:00.000Z' },
    { $id: 'dummy3', first_name: 'Carlo', middle_name: 'M.', last_name: 'Santos', student_id: '2021-00789', course: 'BSECE', school_name: 'PLM', email: 'carlo@email.com', required_hours: 500, completed_hours: 500, $createdAt: '2024-06-01T00:00:00.000Z' }
  ];

  private readonly DUMMY_EVALUATED: Student[] = [
    { $id: 'dummy4', first_name: 'Ana', middle_name: '', last_name: 'Lim', student_id: '2020-00321', course: 'BSIT', school_name: 'PLM', email: 'ana@email.com', required_hours: 500, completed_hours: 500, $createdAt: '2024-01-10T00:00:00.000Z' },
    { $id: 'dummy5', first_name: 'Mark', middle_name: 'B.', last_name: 'Garcia', student_id: '2020-00654', course: 'BSCS', school_name: 'PLM', email: 'mark@email.com', required_hours: 500, completed_hours: 500, $createdAt: '2024-01-15T00:00:00.000Z' }
  ];

  private readonly DUMMY_EVALS: Evaluation[] = [
    { student_id_ref: 'dummy4', punctuality: 5, attendance: 4, quality_of_work: 5, productivity: 4, initiative: 4, cooperation: 5, communication: 4, professionalism: 5, remarks: 'Excellent performance overall.', signature_data: '', evaluated_at: '2024-03-20T00:00:00.000Z' },
    { student_id_ref: 'dummy5', punctuality: 4, attendance: 4, quality_of_work: 3, productivity: 4, initiative: 3, cooperation: 4, communication: 3, professionalism: 4, remarks: 'Good work, room for improvement in communication.', signature_data: '', evaluated_at: '2024-03-22T00:00:00.000Z' }
  ];

  constructor(private appwrite: AppwriteService, private router: Router) {}

  async ngOnInit() { await this.loadData(); }

  freshEval(): Evaluation {
    return { student_id_ref: '', punctuality: 0, attendance: 0, quality_of_work: 0, productivity: 0, initiative: 0, cooperation: 0, communication: 0, professionalism: 0, remarks: '', signature_data: '', evaluated_at: '' };
  }

  async loadData() {
    this.loading = true;
    try {
      const [studentsRes, evalsRes] = await Promise.all([
        this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL),
        this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.EVAL_COL)
      ]);
      (evalsRes.documents as any[]).forEach(e => this.evaluationMap.set(e.student_id_ref, e as Evaluation));
      const all = (studentsRes.documents as any[]).filter(s => (s.completed_hours || 0) >= this.REQUIRED_HOURS);
      this.students          = all.filter(s => !this.evaluationMap.has(s.$id));
      this.evaluatedStudents = all.filter(s =>  this.evaluationMap.has(s.$id));
    } catch (err: any) {
      console.warn('Using dummy data:', err.message);
      this.DUMMY_EVALS.forEach(e => this.evaluationMap.set(e.student_id_ref, e));
      this.students          = [...this.DUMMY_STUDENTS];
      this.evaluatedStudents = [...this.DUMMY_EVALUATED];
    } finally {
      this.filteredStudents  = [...this.students];
      this.filteredEvaluated = [...this.evaluatedStudents];
      this.updatePagination();
      this.updatePaginationEval();
      this.loading = false;
    }
  }

  setTab(tab: 'pending' | 'evaluated') {
    this.activeTab = tab; this.searchQuery = '';
    this.filteredStudents = [...this.students]; this.filteredEvaluated = [...this.evaluatedStudents];
    this.currentPage = 1; this.currentPageEval = 1;
    this.updatePagination(); this.updatePaginationEval();
  }

  onSearch(event: any) {
    const q = event.target.value.toLowerCase(); this.searchQuery = q;
    const match = (s: Student) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) || s.course.toLowerCase().includes(q);
    if (this.activeTab === 'pending') { this.filteredStudents = this.students.filter(match); this.currentPage = 1; this.updatePagination(); }
    else { this.filteredEvaluated = this.evaluatedStudents.filter(match); this.currentPageEval = 1; this.updatePaginationEval(); }
  }

  updatePagination()     { this.totalPages     = Math.max(1, Math.ceil(this.filteredStudents.length  / this.pageSize)); this.pageNumbers     = Array.from({ length: this.totalPages     }, (_, i) => i + 1); }
  updatePaginationEval() { this.totalPagesEval = Math.max(1, Math.ceil(this.filteredEvaluated.length / this.pageSize)); this.pageNumbersEval = Array.from({ length: this.totalPagesEval }, (_, i) => i + 1); }

  get pagedStudents()  { const s = (this.currentPage     - 1) * this.pageSize; return this.filteredStudents.slice(s, s  + this.pageSize); }
  get pagedEvaluated() { const s = (this.currentPageEval - 1) * this.pageSize; return this.filteredEvaluated.slice(s, s + this.pageSize); }

  goToPage(p: number)     { this.currentPage     = p; }
  prevPage()              { if (this.currentPage > 1)                this.currentPage--; }
  nextPage()              { if (this.currentPage < this.totalPages)  this.currentPage++; }
  goToPageEval(p: number) { this.currentPageEval = p; }
  prevPageEval()          { if (this.currentPageEval > 1)                 this.currentPageEval--; }
  nextPageEval()          { if (this.currentPageEval < this.totalPagesEval) this.currentPageEval++; }

  openEvaluate(student: Student) {
    this.selectedStudent = student;
    this.evaluation = { ...this.freshEval(), student_id_ref: student.$id };
    this.hasSignature = false;
    this.signatureMode = 'draw';
    this.uploadedFileName = '';
    this.showModal = true;
    setTimeout(() => this.initCanvas(), 150);
  }

  viewEvaluation(student: Student) {
    const ev = this.evaluationMap.get(student.$id); if (!ev) return;
    this.selectedStudent = student; this.evaluation = { ...ev };
    this.hasSignature = !!ev.signature_data;
    this.signatureMode = 'draw';
    this.showModal = true;
    setTimeout(() => {
      this.initCanvas();
      if (ev.signature_data && this.ctx && this.canvas) {
        const img = new Image(); img.onload = () => this.ctx!.drawImage(img, 0, 0); img.src = ev.signature_data;
      }
    }, 150);
  }

  closeModal() { this.showModal = false; this.selectedStudent = null; this.clearCanvas(); this.uploadedFileName = ''; }
  isViewMode(): boolean { return !!this.selectedStudent && this.evaluationMap.has(this.selectedStudent.$id); }

  setSignatureMode(mode: 'draw' | 'upload') {
    if (this.isViewMode()) return;
    this.signatureMode = mode;
    this.hasSignature = false;
    this.uploadedFileName = '';
    if (mode === 'draw') { setTimeout(() => { this.initCanvas(); this.clearCanvas(); }, 50); }
  }

  setRating(criterion: string, value: number) { if (this.isViewMode()) return; (this.evaluation as any)[criterion] = value; }
  getRating(criterion: string): number { return (this.evaluation as any)[criterion] || 0; }
  getRatingLabelForValue(value: number): string { return this.RATING_LABELS[value] || ''; }

  getRatingColor(value: number): string {
    if (value === 5) return '#059669'; if (value === 4) return '#2563eb';
    if (value === 3) return '#d97706'; if (value === 2) return '#ea580c';
    if (value === 1) return '#dc2626'; return '#9ca3af';
  }

  getOverallAverage(): number {
    const keys = ['punctuality','attendance','quality_of_work','productivity','initiative','cooperation','communication','professionalism'];
    const filled = keys.map(k => (this.evaluation as any)[k]).filter(v => v > 0);
    if (!filled.length) return 0;
    return parseFloat((filled.reduce((a, b) => a + b, 0) / filled.length).toFixed(2));
  }

  getOverallLabel(avg: number): string {
    if (avg >= 4.5) return 'Excellent'; if (avg >= 3.5) return 'Very Good';
    if (avg >= 2.5) return 'Good';      if (avg >= 1.5) return 'Fair';
    if (avg > 0)    return 'Poor';      return '';
  }

  getOverallColor(avg: number): string {
    if (avg >= 4.5) return '#059669'; if (avg >= 3.5) return '#2563eb';
    if (avg >= 2.5) return '#d97706'; if (avg >= 1.5) return '#ea580c';
    return '#dc2626';
  }

  isFormValid(): boolean {
    const keys = ['punctuality','attendance','quality_of_work','productivity','initiative','cooperation','communication','professionalism'];
    return keys.every(k => (this.evaluation as any)[k] > 0) && this.hasSignature;
  }

  initCanvas() {
    this.canvas = document.getElementById('sigCanvas') as HTMLCanvasElement; if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) { this.ctx.strokeStyle = '#0818A8'; this.ctx.lineWidth = 2; this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round'; }
  }

  onMouseDown(e: MouseEvent) {
    if (this.isViewMode()) return; this.isDrawing = true;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    this.lastX = (e.clientX - rect.left) * (this.canvas!.width / rect.width);
    this.lastY = (e.clientY - rect.top)  * (this.canvas!.height / rect.height);
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isDrawing || !this.ctx || this.isViewMode()) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas!.width / rect.width);
    const y = (e.clientY - rect.top)  * (this.canvas!.height / rect.height);
    this.ctx.beginPath(); this.ctx.moveTo(this.lastX, this.lastY); this.ctx.lineTo(x, y); this.ctx.stroke();
    this.lastX = x; this.lastY = y; this.hasSignature = true;
  }

  onMouseUp()    { this.isDrawing = false; }
  onMouseLeave() { this.isDrawing = false; }

  onTouchStart(e: TouchEvent) {
    if (this.isViewMode()) return; e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect(); const t = e.touches[0];
    this.lastX = (t.clientX - rect.left) * (this.canvas!.width / rect.width);
    this.lastY = (t.clientY - rect.top)  * (this.canvas!.height / rect.height);
    this.isDrawing = true;
  }

  onTouchMove(e: TouchEvent) {
    if (!this.isDrawing || !this.ctx || this.isViewMode()) return; e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect(); const t = e.touches[0];
    const x = (t.clientX - rect.left) * (this.canvas!.width / rect.width);
    const y = (t.clientY - rect.top)  * (this.canvas!.height / rect.height);
    this.ctx.beginPath(); this.ctx.moveTo(this.lastX, this.lastY); this.ctx.lineTo(x, y); this.ctx.stroke();
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
      const img = new Image();
      img.onload = () => {
        if (!this.canvas || !this.ctx) this.initCanvas();
        if (!this.canvas || !this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const canvasRatio = this.canvas.width / this.canvas.height;
        const imgRatio    = img.width / img.height;
        let drawW = this.canvas.width;
        let drawH = this.canvas.height;
        let drawX = 0;
        let drawY = 0;
        if (imgRatio > canvasRatio) {
          drawH = this.canvas.width / imgRatio;
          drawY = (this.canvas.height - drawH) / 2;
        } else {
          drawW = this.canvas.height * imgRatio;
          drawX = (this.canvas.width - drawW) / 2;
        }
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

  async submitEvaluation() {
    if (!this.isFormValid() || !this.selectedStudent) return;
    this.submitting = true;
    try {
      const sigData = this.canvas ? this.canvas.toDataURL('image/png') : '';
      const payload = { ...this.evaluation, signature_data: sigData, evaluated_at: new Date().toISOString() };
      await this.appwrite.databases.createDocument(this.appwrite.DATABASE_ID, this.EVAL_COL, 'unique()', payload);
      this.evaluationMap.set(this.selectedStudent.$id, payload as Evaluation);
      this.students          = this.students.filter(s => s.$id !== this.selectedStudent!.$id);
      this.evaluatedStudents = [this.selectedStudent, ...this.evaluatedStudents];
      this.filteredStudents  = [...this.students];
      this.filteredEvaluated = [...this.evaluatedStudents];
      this.updatePagination(); this.updatePaginationEval();
      this.closeModal();
    } catch (err: any) { console.error('Submit error:', err.message); }
    finally { this.submitting = false; }
  }

  onToggleSidebar(c: boolean) { this.isCollapsed = c; }

  getFullName(s: Student): string { return `${s.first_name}${s.middle_name ? ' ' + s.middle_name : ''} ${s.last_name}`; }

  getAvatarUrl(student: Student): string {
    if (student.profile_photo_id) return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${student.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    const initials = `${student.first_name.charAt(0)} ${student.last_name.charAt(0)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0818A8&color=fff&size=64`;
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
    const ev = this.evaluationMap.get(s.$id); if (!ev) return 0;
    const keys = ['punctuality','attendance','quality_of_work','productivity','initiative','cooperation','communication','professionalism'];
    return parseFloat((keys.reduce((a, k) => a + ((ev as any)[k] || 0), 0) / keys.length).toFixed(2));
  }
}