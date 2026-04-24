import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';
import { ID, Query } from 'appwrite';
import Swal from 'sweetalert2';

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
  answers_json: string;
  remarks_sections_json: string;
  recommendation?: 'highly_recommended' | 'recommended' | 'recommended_with_reservations' | 'not_recommended';
  signature_data: string;
  evaluated_at: string;
  period_from?: string;
  period_to?: string;
  criteria_snapshot: string;
  remarks_sections_snapshot: string;
}

/** A single question under a criterion */
export interface CriterionQuestion {
  qkey: string;
  text: string;
  /** Number of rating choices (2–10) */
  numChoices: number;
  /** Labels for each choice value */
  choiceLabels: Record<number, string>;
  /** Answer: chosen numeric rating (0 = not yet rated) */
  rating?: number;
}

/** Runtime shape of one editable criterion */
export interface EditableCriterion {
  key: string;
  /** Display prefix: 'icon' | 'text' */
  prefixType: 'icon' | 'text';
  /** Used when prefixType === 'icon' */
  icon: string;
  /** Used when prefixType === 'text' — bold prefix label e.g. "Part 1" */
  prefixText: string;
  label: string;
  questions: CriterionQuestion[];
}

/** A free-text remarks section (e.g. Strengths, Areas for Improvement) */
export interface RemarksSection {
  key: string;
  label: string;
  icon: string;
  iconColor: string;
  placeholder: string;
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

  // ── Criteria editor ───────────────────────────────────────────────────────
  showCriteriaEditor      = false;
  editableCriteria        : EditableCriterion[] = [];
  editableRemarksSections : RemarksSection[] = [];
  newCriterionLabel       = '';
  newRemarksSectionLabel  = '';
  criteriaDocId: string | null = null; // tracks existing doc $id

  setPrefixTypeNone(criterion: any) {
    criterion.prefixType = 'none';
  }

  availableIcons = [
    'fa-clock', 'fa-calendar-check', 'fa-medal', 'fa-chart-line', 'fa-bolt',
    'fa-handshake', 'fa-comments', 'fa-user-tie', 'fa-shield-halved',
    'fa-star', 'fa-lightbulb', 'fa-brain', 'fa-rocket', 'fa-thumbs-up',
    'fa-check-circle', 'fa-award', 'fa-flag', 'fa-fire', 'fa-leaf', 'fa-gem',
    'fa-arrow-trend-up', 'fa-pen', 'fa-clipboard', 'fa-file-alt', 'fa-list',
    'fa-bullseye', 'fa-puzzle-piece', 'fa-graduation-cap', 'fa-code', 'fa-wrench'
  ];

  readonly BUCKET_ID      = '69baaf64002ceb2490df';
  readonly PROJECT_ID     = '69ba8d9c0027d10c447f';
  readonly ENDPOINT       = 'https://sgp.cloud.appwrite.io/v1';
  readonly EVAL_COL       = 'evaluations';
  readonly REQUIRED_HOURS = 500;
  readonly CRITERIA_COL = 'supervisor_criteria';


  /** answers keyed by "criterionKey::qkey" — stores the selected rating (number as string) */
  answers: Record<string, string> = {};
  /** remarks keyed by remarksSection key */
  remarkAnswers: Record<string, string> = {};

  // ── Default 5-choice labels ───────────────────────────────────────────────
  private readonly DEFAULT_CHOICE_LABELS_5: Record<number, string> = {
    1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V.Good', 5: 'Excellent'
  };

  // ── Default criteria ──────────────────────────────────────────────────────
  private readonly DEFAULT_CRITERIA: EditableCriterion[] = [
    {
      key: 'punctuality', prefixType: 'icon', icon: 'fa-clock', prefixText: '',
      label: 'Punctuality',
      questions: [
        { qkey: 'q1', text: 'Does the trainee arrive on time and follow the assigned schedule?', numChoices: 5, choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V.Good', 5: 'Excellent' } }
      ]
    },
    {
      key: 'attendance', prefixType: 'icon', icon: 'fa-calendar-check', prefixText: '',
      label: 'Attendance',
      questions: [
        { qkey: 'q1', text: 'Does the trainee maintain consistent attendance and avoid unnecessary absences?', numChoices: 5, choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V.Good', 5: 'Excellent' } }
      ]
    },
    {
      key: 'quality_of_work', prefixType: 'icon', icon: 'fa-medal', prefixText: '',
      label: 'Quality of Work',
      questions: [
        { qkey: 'q1', text: 'Does the trainee complete tasks accurately and with attention to detail?', numChoices: 5, choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V.Good', 5: 'Excellent' } }
      ]
    },
    {
      key: 'productivity', prefixType: 'icon', icon: 'fa-chart-line', prefixText: '',
      label: 'Productivity',
      questions: [
        { qkey: 'q1', text: 'Does the trainee complete assigned tasks efficiently and on time?', numChoices: 5, choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V.Good', 5: 'Excellent' } }
      ]
    },
    {
      key: 'initiative', prefixType: 'icon', icon: 'fa-bolt', prefixText: '',
      label: 'Initiative',
      questions: [
        { qkey: 'q1', text: 'Does the trainee show willingness to take responsibility and perform tasks without being told?', numChoices: 5, choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V.Good', 5: 'Excellent' } }
      ]
    },
    {
      key: 'cooperation', prefixType: 'icon', icon: 'fa-handshake', prefixText: '',
      label: 'Cooperation / Teamwork',
      questions: [
        { qkey: 'q1', text: 'Does the trainee work well with others and maintain good relationships?', numChoices: 5, choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V.Good', 5: 'Excellent' } }
      ]
    },
    {
      key: 'communication', prefixType: 'icon', icon: 'fa-comments', prefixText: '',
      label: 'Communication Skills',
      questions: [
        { qkey: 'q1', text: 'Does the trainee communicate clearly and professionally with staff and supervisors?', numChoices: 5, choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V.Good', 5: 'Excellent' } }
      ]
    },
    {
      key: 'professionalism', prefixType: 'icon', icon: 'fa-user-tie', prefixText: '',
      label: 'Professionalism',
      questions: [
        { qkey: 'q1', text: 'Does the trainee demonstrate proper behavior, attitude, and respect in the workplace?', numChoices: 5, choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V.Good', 5: 'Excellent' } }
      ]
    },
    {
      key: 'dependability', prefixType: 'icon', icon: 'fa-shield-halved', prefixText: '',
      label: 'Dependability',
      questions: [
        { qkey: 'q1', text: 'Can the trainee be trusted with tasks and does the trainee follow through on commitments?', numChoices: 5, choiceLabels: { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'V.Good', 5: 'Excellent' } }
      ]
    }
  ];

  // ── Default remarks sections ──────────────────────────────────────────────
  private readonly DEFAULT_REMARKS_SECTIONS: RemarksSection[] = [
    {
      key: 'strengths',
      label: 'Strengths',
      icon: 'fa-thumbs-up',
      iconColor: '#059669',
      placeholder: "Describe the intern's notable strengths and accomplishments..."
    },
    {
      key: 'areas_for_improvement',
      label: 'Areas for Improvement',
      icon: 'fa-arrow-trend-up',
      iconColor: '#d97706',
      placeholder: 'What areas should the intern focus on improving?'
    },
    {
      key: 'overall_remarks',
      label: 'Overall Remarks / Comments',
      icon: 'fa-clipboard',
      iconColor: '#6b7280',
      placeholder: "Write your overall remarks about this student's OJT performance..."
    }
  ];

  CRITERIA        : EditableCriterion[] = [];
  REMARKS_SECTIONS: RemarksSection[]    = [];

  readonly RECOMMENDATIONS = [
    { value: 'highly_recommended',            label: 'Highly Recommended' },
    { value: 'recommended',                   label: 'Recommended' },
    { value: 'recommended_with_reservations', label: 'With Reservations' },
    { value: 'not_recommended',               label: 'Not Recommended' }
  ];

  evaluation = this.freshEvalMeta();

  constructor(private appwrite: AppwriteService, private router: Router) {}

 async ngOnInit() {
  await this.loadCurrentSupervisor();      // 1. get supervisor first
  await this.loadCriteriaFromStorage();    // 2. then load their criteria
  await this.loadData();                   // 3. then load students
}
  freshEvalMeta() {
    return {
      student_id_ref : '',
      recommendation : undefined as any,
      period_from    : '',
      period_to      : '',
      supervisor_name: ''
    };
  }

  // ── Choice helpers ────────────────────────────────────────────────────────
  buildDefaultChoiceLabels(n: number): Record<number, string> {
    if (n === 2) return { 1: 'Unsatisfactory', 2: 'Satisfactory' };
    if (n === 3) return { 1: 'Poor', 2: 'Average', 3: 'Excellent' };
    if (n === 4) return { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Excellent' };
    if (n === 5) return { ...this.DEFAULT_CHOICE_LABELS_5 };
    const out: Record<number, string> = {};
    for (let i = 1; i <= n; i++) out[i] = `Level ${i}`;
    return out;
  }

  choiceRange(q: CriterionQuestion): number[] {
    const n = typeof q.numChoices === 'number' && q.numChoices >= 2 ? q.numChoices : 5;
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  onNumChoicesChange(q: CriterionQuestion) {
    const n        = q.numChoices;
    const existing = { ...q.choiceLabels };
    const fresh    = this.buildDefaultChoiceLabels(n);
    const newLabels: Record<number, string> = {};
    for (let i = 1; i <= n; i++) {
      newLabels[i] = existing[i] ?? fresh[i] ?? `Level ${i}`;
    }
    q.choiceLabels = newLabels;
  }

  getChoiceLabel(q: CriterionQuestion, v: number): string {
    return q.choiceLabels?.[v] ?? `Level ${v}`;
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  async loadCriteriaFromStorage() {
  if (!this.currentSupervisor?.$id) {
    this.CRITERIA = JSON.parse(JSON.stringify(this.DEFAULT_CRITERIA));
    this.REMARKS_SECTIONS = JSON.parse(JSON.stringify(this.DEFAULT_REMARKS_SECTIONS));
    return;
  }
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.CRITERIA_COL,
      [Query.equal('supervisor_id', this.currentSupervisor.$id), Query.limit(1)]
    );
    if (res.documents.length > 0) {
      const doc = res.documents[0] as any;
      this.criteriaDocId = doc.$id;
      try {
        const parsed = JSON.parse(doc.criteria_json ?? '[]');
        this.CRITERIA = parsed.length ? parsed : JSON.parse(JSON.stringify(this.DEFAULT_CRITERIA));
      } catch {
        this.CRITERIA = JSON.parse(JSON.stringify(this.DEFAULT_CRITERIA));
      }
      try {
        const parsed = JSON.parse(doc.remarks_sections_json ?? '[]');
        this.REMARKS_SECTIONS = parsed.length ? parsed : JSON.parse(JSON.stringify(this.DEFAULT_REMARKS_SECTIONS));
      } catch {
        this.REMARKS_SECTIONS = JSON.parse(JSON.stringify(this.DEFAULT_REMARKS_SECTIONS));
      }
    } else {
      // First time — no saved criteria yet, use defaults
      this.criteriaDocId = null;
      this.CRITERIA = JSON.parse(JSON.stringify(this.DEFAULT_CRITERIA));
      this.REMARKS_SECTIONS = JSON.parse(JSON.stringify(this.DEFAULT_REMARKS_SECTIONS));
    }
  } catch (err: any) {
    console.error('Failed to load criteria:', err.message);
    this.CRITERIA = JSON.parse(JSON.stringify(this.DEFAULT_CRITERIA));
    this.REMARKS_SECTIONS = JSON.parse(JSON.stringify(this.DEFAULT_REMARKS_SECTIONS));
  }
}


 async saveCriteriaToStorage() {
  if (!this.currentSupervisor?.$id) return;
  const payload = {
    supervisor_id: this.currentSupervisor.$id,
    criteria_json: JSON.stringify(this.CRITERIA),
    remarks_sections_json: JSON.stringify(this.REMARKS_SECTIONS)
  };
  try {
    if (this.criteriaDocId) {
      // Update existing doc
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.CRITERIA_COL,
        this.criteriaDocId,
        payload
      );
    } else {
      // Create new doc
      const doc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.CRITERIA_COL,
        ID.unique(),
        payload
      );
      this.criteriaDocId = (doc as any).$id;
    }
  } catch (err: any) {
    console.error('Failed to save criteria:', err.message);
    Swal.fire({ icon: 'error', title: 'Save failed', text: err.message });
  }
}
  // ── Criteria editor ───────────────────────────────────────────────────────
  openCriteriaEditor() {
    this.editableCriteria        = JSON.parse(JSON.stringify(this.CRITERIA));
    this.editableRemarksSections = JSON.parse(JSON.stringify(this.REMARKS_SECTIONS));
    this.newCriterionLabel       = '';
    this.newRemarksSectionLabel  = '';
    this.showCriteriaEditor      = true;
  }

  closeCriteriaEditor() { this.showCriteriaEditor = false; }

  async saveCriteriaEdits() {
  if (this.editableCriteria.length === 0) return;
  this.CRITERIA = JSON.parse(JSON.stringify(this.editableCriteria));
  this.REMARKS_SECTIONS = JSON.parse(JSON.stringify(this.editableRemarksSections));
  await this.saveCriteriaToStorage();
  this.showCriteriaEditor = false;
  Swal.fire({
    icon: 'success', title: 'Questions saved!',
    toast: true, position: 'top-end',
    showConfirmButton: false, timer: 2000, timerProgressBar: true
  });
}
  resetCriteriaToDefault() {
    this.editableCriteria        = JSON.parse(JSON.stringify(this.DEFAULT_CRITERIA));
    this.editableRemarksSections = JSON.parse(JSON.stringify(this.DEFAULT_REMARKS_SECTIONS));
  }

  // Criterion CRUD
  addCriterion() {
    if (!this.newCriterionLabel.trim()) return;
    this.editableCriteria.push({
      key        : 'custom_' + Date.now(),
      prefixType : 'icon',
      icon       : 'fa-star',
      prefixText : '',
      label      : this.newCriterionLabel.trim(),
      questions  : [{
        qkey        : 'q1',
        text        : `How did the trainee perform in ${this.newCriterionLabel.trim()}?`,
        numChoices  : 5,
        choiceLabels: { ...this.DEFAULT_CHOICE_LABELS_5 }
      }]
    });
    this.newCriterionLabel = '';
  }

  removeCriterion(i: number) { this.editableCriteria.splice(i, 1); }
  moveCriterionUp(i: number) {
    if (i > 0) {
      const t = this.editableCriteria[i];
      this.editableCriteria[i]   = this.editableCriteria[i - 1];
      this.editableCriteria[i - 1] = t;
    }
  }
  moveCriterionDown(i: number) {
    if (i < this.editableCriteria.length - 1) {
      const t = this.editableCriteria[i];
      this.editableCriteria[i]     = this.editableCriteria[i + 1];
      this.editableCriteria[i + 1] = t;
    }
  }

  // Question CRUD
  addQuestion(c: EditableCriterion) {
    c.questions.push({
      qkey        : 'q' + Date.now(),
      text        : '',
      numChoices  : 5,
      choiceLabels: { ...this.DEFAULT_CHOICE_LABELS_5 }
    });
  }
  removeQuestion(c: EditableCriterion, qi: number) { c.questions.splice(qi, 1); }

  // Remarks section CRUD
  addRemarksSection() {
    if (!this.newRemarksSectionLabel.trim()) return;
    this.editableRemarksSections.push({
      key        : 'custom_remarks_' + Date.now(),
      label      : this.newRemarksSectionLabel.trim(),
      icon       : 'fa-pen',
      iconColor  : '#6b7280',
      placeholder: `Write your ${this.newRemarksSectionLabel.trim()} here...`
    });
    this.newRemarksSectionLabel = '';
  }
  removeRemarksSection(i: number) { this.editableRemarksSections.splice(i, 1); }
  moveRemarksSectionUp(i: number) {
    if (i > 0) {
      const t = this.editableRemarksSections[i];
      this.editableRemarksSections[i]     = this.editableRemarksSections[i - 1];
      this.editableRemarksSections[i - 1] = t;
    }
  }
  moveRemarksSectionDown(i: number) {
    if (i < this.editableRemarksSections.length - 1) {
      const t = this.editableRemarksSections[i];
      this.editableRemarksSections[i]     = this.editableRemarksSections[i + 1];
      this.editableRemarksSections[i + 1] = t;
    }
  }

  // ── Supervisor ────────────────────────────────────────────────────────────
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

  // ── Data loading ──────────────────────────────────────────────────────────
  async loadData() {
     if (!this.currentSupervisor?.$id) return;
  this.loading = true;
  try {
    const [studentsRes, evalsRes] = await Promise.all([
      this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        [
          Query.equal('supervisor_id', this.currentSupervisor.$id), // ← only this supervisor's interns
          Query.limit(500)
        ]
      ),
      this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.EVAL_COL,
        [Query.limit(500)]
      )
    ]);

    (evalsRes.documents as any[]).forEach(e => this.evaluationMap.set(e.student_id_ref, e as Evaluation));

    const all = (studentsRes.documents as any[]).filter(
      s => (s.completed_hours || 0) >= (s.required_hours || this.REQUIRED_HOURS)
    );

    this.students          = all.filter(s => !this.evaluationMap.has(s.$id));
    this.evaluatedStudents = all.filter(s =>  this.evaluationMap.has(s.$id));

  } catch (err: any) {
    console.error('Failed to load data:', err.message);
  } finally {
    this.filteredStudents  = [...this.students];
    this.filteredEvaluated = [...this.evaluatedStudents];
    this.updatePagination();
    this.updatePaginationEval();
    this.loading = false;
  }
}
  // ── Tabs & Search ─────────────────────────────────────────────────────────
  setTab(tab: 'pending' | 'evaluated') {
    this.activeTab         = tab;
    this.searchQuery       = '';
    this.filteredStudents  = [...this.students];
    this.filteredEvaluated = [...this.evaluatedStudents];
    this.currentPage       = 1;
    this.currentPageEval   = 1;
    this.updatePagination();
    this.updatePaginationEval();
  }

  onSearch(event: any) {
    const q   = event.target.value.toLowerCase();
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

  // ── Pagination ────────────────────────────────────────────────────────────
  updatePagination()     { this.totalPages     = Math.max(1, Math.ceil(this.filteredStudents.length  / this.pageSize)); this.pageNumbers     = Array.from({ length: this.totalPages     }, (_, i) => i + 1); }
  updatePaginationEval() { this.totalPagesEval = Math.max(1, Math.ceil(this.filteredEvaluated.length / this.pageSize)); this.pageNumbersEval = Array.from({ length: this.totalPagesEval }, (_, i) => i + 1); }
  get pagedStudents()  { const s = (this.currentPage     - 1) * this.pageSize; return this.filteredStudents.slice(s, s  + this.pageSize); }
  get pagedEvaluated() { const s = (this.currentPageEval - 1) * this.pageSize; return this.filteredEvaluated.slice(s, s + this.pageSize); }
  goToPage(p: number)     { this.currentPage     = p; }
  prevPage()              { if (this.currentPage > 1)                this.currentPage--;      }
  nextPage()              { if (this.currentPage < this.totalPages)  this.currentPage++;      }
  goToPageEval(p: number) { this.currentPageEval = p; }
  prevPageEval()          { if (this.currentPageEval > 1)                   this.currentPageEval--; }
  nextPageEval()          { if (this.currentPageEval < this.totalPagesEval) this.currentPageEval++; }

  // ── Modal open / close ────────────────────────────────────────────────────
  async openEvaluate(student: Student) {
    this.selectedStudent  = student;
    this.evaluation       = { ...this.freshEvalMeta(), student_id_ref: student.$id };
    this.answers          = {};
    this.remarkAnswers    = {};
    this.hasSignature     = false;
    this.signatureMode    = 'draw';
    this.uploadedFileName = '';
    this.showModal        = true;
    await this.autoFillTrainingPeriod(student.$id);
    setTimeout(() => this.initCanvas(), 150);
  }

  private async autoFillTrainingPeriod(studentId: string) {
    try {
      const res   = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, 'attendance', [Query.equal('student_id', studentId)]
      );
      const dates = (res.documents as any[]).map(a => a.date).filter(Boolean).sort();
      if (dates.length > 0) {
        const toInputDate = (d: string) => {
          const p = new Date(d);
          return isNaN(p.getTime()) ? d : p.toISOString().split('T')[0];
        };
        this.evaluation.period_from = toInputDate(dates[0]);
        this.evaluation.period_to   = toInputDate(dates[dates.length - 1]);
      }
    } catch (err: any) { console.warn('Could not auto-fill training period:', err.message); }
  }

  viewEvaluation(student: Student) {
    const ev = this.evaluationMap.get(student.$id);
    if (!ev) return;
    this.selectedStudent  = student;
    this.evaluation       = { ...this.freshEvalMeta(), ...ev } as any;
    this.hasSignature     = !!ev.signature_data;
    this.signatureMode    = 'draw';
    this.showModal        = true;
    try { this.answers       = JSON.parse(ev.answers_json           ?? '{}'); } catch { this.answers       = {}; }
    try { this.remarkAnswers = JSON.parse(ev.remarks_sections_json  ?? '{}'); } catch { this.remarkAnswers = {}; }
    try { const snap = JSON.parse(ev.criteria_snapshot         ?? '[]'); if (snap.length) this.CRITERIA         = snap; } catch {}
    try { const snap = JSON.parse(ev.remarks_sections_snapshot ?? '[]'); if (snap.length) this.REMARKS_SECTIONS = snap; } catch {}
    setTimeout(() => {
      this.initCanvas();
      if (ev.signature_data && this.ctx && this.canvas) {
        const img  = new Image();
        img.onload = () => this.ctx!.drawImage(img, 0, 0);
        img.src    = ev.signature_data;
      }
    }, 150);
  }

closeModal() {
  this.showModal = false;
  this.selectedStudent = null;
  this.clearCanvas();
  this.uploadedFileName = '';
  this.loadCriteriaFromStorage(); // reloads this supervisor's own criteria from DB
}
  isViewMode(): boolean {
    return !!this.selectedStudent && this.evaluationMap.has(this.selectedStudent.$id);
  }

  // ── Answers / Ratings ─────────────────────────────────────────────────────
  getAnswerKey(criterionKey: string, qkey: string): string {
    return `${criterionKey}::${qkey}`;
  }

  getRatingValue(criterionKey: string, qkey: string): number {
    return parseInt(this.answers[this.getAnswerKey(criterionKey, qkey)] ?? '0', 10) || 0;
  }

  setRating(criterionKey: string, qkey: string, value: number) {
    if (this.isViewMode()) return;
    this.answers[this.getAnswerKey(criterionKey, qkey)] = String(value);
  }

  // ── Overall average (normalized to 5-point scale) ─────────────────────────
  getNormalizedAverage(): number {
    const normalized: number[] = [];
    for (const c of this.CRITERIA) {
      for (const q of c.questions) {
        const raw = this.getRatingValue(c.key, q.qkey);
        if (raw > 0) {
          normalized.push((raw / (q.numChoices || 5)) * 5);
        }
      }
    }
    if (!normalized.length) return 0;
    return parseFloat((normalized.reduce((a, b) => a + b, 0) / normalized.length).toFixed(2));
  }

  getAllRated(): boolean {
    return this.CRITERIA.every(c =>
      c.questions.every(q => this.getRatingValue(c.key, q.qkey) > 0)
    );
  }

  getTotalQuestions(): number {
    return this.CRITERIA.reduce((sum, c) => sum + c.questions.length, 0);
  }

  getRatedCount(): number {
    return this.CRITERIA.reduce((sum, c) =>
      sum + c.questions.filter(q => this.getRatingValue(c.key, q.qkey) > 0).length, 0
    );
  }

  getOverallLabel(avg: number): string {
    if (avg >= 4.5) return 'Excellent';
    if (avg >= 3.5) return 'Very Good';
    if (avg >= 2.5) return 'Good';
    if (avg >= 1.5) return 'Fair';
    if (avg  >  0)  return 'Poor';
    return '';
  }

  getOverallColor(avg: number): string {
    if (avg >= 4.5) return '#059669';
    if (avg >= 3.5) return '#2563eb';
    if (avg >= 2.5) return '#d97706';
    if (avg >= 1.5) return '#ea580c';
    return '#dc2626';
  }

  getRatingColor(value: number, max: number = 5): string {
    const ratio = max > 1 ? (value - 1) / (max - 1) : 1;
    if (ratio >= 0.9)  return '#059669';
    if (ratio >= 0.65) return '#2563eb';
    if (ratio >= 0.45) return '#d97706';
    if (ratio >= 0.25) return '#ea580c';
    return '#dc2626';
  }

  // ── Recommendation ────────────────────────────────────────────────────────
  setRecommendation(value: string) {
    if (this.isViewMode()) return;
    this.evaluation.recommendation = value as any;
  }

  // ── Overall rating for evaluated table ───────────────────────────────────
  getEvalAverage(s: Student): number {
    const ev = this.evaluationMap.get(s.$id);
    if (!ev) return 0;
    try {
      const ans: Record<string, string>   = JSON.parse(ev.answers_json   ?? '{}');
      const criteria: EditableCriterion[] = JSON.parse(ev.criteria_snapshot ?? '[]');
      if (!criteria.length) return 0;
      const normalized: number[] = [];
      for (const c of criteria) {
        for (const q of c.questions) {
          const key = `${c.key}::${q.qkey}`;
          const raw = parseInt(ans[key] ?? '0', 10) || 0;
          if (raw > 0) normalized.push((raw / (q.numChoices || 5)) * 5);
        }
      }
      if (!normalized.length) return 0;
      return parseFloat((normalized.reduce((a, b) => a + b, 0) / normalized.length).toFixed(2));
    } catch { return 0; }
  }

  // ── Form validation ───────────────────────────────────────────────────────
  isFormValid(): boolean {
    const allRated = this.CRITERIA.every(c =>
      c.questions.every(q => this.getRatingValue(c.key, q.qkey) > 0)
    );
    return allRated && !!this.evaluation.recommendation && this.hasSignature;
  }

  // ── Signature ─────────────────────────────────────────────────────────────
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
        const cR = this.canvas.width / this.canvas.height;
        const iR = img.width / img.height;
        let dW = this.canvas.width, dH = this.canvas.height, dX = 0, dY = 0;
        if (iR > cR) { dH = this.canvas.width / iR;  dY = (this.canvas.height - dH) / 2; }
        else         { dW = this.canvas.height * iR;  dX = (this.canvas.width  - dW) / 2; }
        this.ctx.drawImage(img, dX, dY, dW, dH);
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

  // ── Submit ────────────────────────────────────────────────────────────────
  async submitEvaluation() {
    if (!this.isFormValid() || !this.selectedStudent) return;
    this.submitting = true;
    try {
      const sigData = this.canvas ? this.canvas.toDataURL('image/png') : '';
      const toISO   = (d?: string): string | null => d ? new Date(d).toISOString() : null;
      // Extract individual criterion averages for legacy columns
const getCriterionAvg = (key: string): number => {
  const criterion = this.CRITERIA.find(c => c.key === key);
  if (!criterion) return 0;
  const vals = criterion.questions
    .map(q => this.getRatingValue(key, q.qkey))
    .filter(v => v > 0);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

const payload: Record<string, any> = {
  student_id_ref            : this.selectedStudent.$id,
  supervisor_id             : this.currentSupervisor?.$id        ?? null,
  supervisor_name           : this.supervisorFullName,
  answers_json              : JSON.stringify(this.answers),
  remarks_sections_json     : JSON.stringify(this.remarkAnswers),
  criteria_snapshot         : JSON.stringify(this.CRITERIA),
  remarks_sections_snapshot : JSON.stringify(this.REMARKS_SECTIONS),
  recommendation            : this.evaluation.recommendation     ?? null,
  signature_data            : sigData,
  evaluated_at              : new Date().toISOString(),
  period_from               : toISO(this.evaluation.period_from),
  period_to                 : toISO(this.evaluation.period_to),

  // Individual legacy columns (all nullable in Appwrite)
  punctuality               : getCriterionAvg('punctuality')      || null,
  attendance                : getCriterionAvg('attendance')       || null,
  quality_of_work           : getCriterionAvg('quality_of_work')  || null,
  productivity              : getCriterionAvg('productivity')     || null,
  initiative                : getCriterionAvg('initiative')       || null,
  cooperation               : getCriterionAvg('cooperation')      || null,
  communication             : getCriterionAvg('communication')    || null,
  professionalism           : getCriterionAvg('professionalism')  || null,
  dependability             : getCriterionAvg('dependability')    || null,
};
      await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID, this.EVAL_COL, ID.unique(), payload
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
      console.error('Submit error:', err.message);
      alert('Failed to submit evaluation: ' + err.message);
    } finally { this.submitting = false; }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
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
}