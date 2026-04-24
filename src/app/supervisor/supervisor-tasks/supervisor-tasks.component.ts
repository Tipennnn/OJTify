import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import { ID, Query } from 'appwrite';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Intern {
  $id: string;
  first_name: string;
  last_name: string;
  course: string;
  supervisor_id?: string;
  profile_photo_id?: string;
}

interface Task {
  $id?: string;
  title: string;
  description: string;
  posted: string;
  due: string;
  status: 'completed' | 'pending';
  assigned_intern_ids?: string;
  attachment_file_id?: string;
  attachment_file_name?: string;
  assignedInterns?: { name: string; img: string }[];
  comments?: any[];
  submissions?: any[];
  supervisor_name?: string;
  score?: number | null;
}

interface LogbookEntry {
  $id?: string;
  student_id: string;
  student_name: string;
  entry_date: string;
  tasks_done: string;
  reflection: string;
  created_at: string;
  score?: number | null;
}

interface LogbookPhoto {
  $id?: string;
  entry_id: string;
  student_id: string;
  file_id: string;
  file_name: string;
  uploaded_at: string;
}

interface Submission {
  $id?: string;
  task_id: string;
  student_id: string;
  file_id: string;
  file_name: string;
  submitted_at: string;
  student_name?: string;
  score?: number | null;
  _scoreInput?: number | null;
  _scoreSaving?: boolean;
}

interface CourseOption {
  abbr: string;
  full: string;
}

const COURSE_LIST: CourseOption[] = [
  { abbr: 'BSIT',     full: 'Bachelor of Science in Information Technology' },
  { abbr: 'BSCS',     full: 'Bachelor of Science in Computer Science' },
  { abbr: 'BSCE',     full: 'Bachelor of Science in Computer Engineering' },
  { abbr: 'BSIS',     full: 'Bachelor of Science in Information Systems' },
  { abbr: 'BSDA',     full: 'Bachelor of Science in Data Analytics' },
  { abbr: 'BSAI',     full: 'Bachelor of Science in Artificial Intelligence' },
  { abbr: 'BSCPE',    full: 'Bachelor of Science in Computer Engineering' },
  { abbr: 'BSEMC',    full: 'Bachelor of Science in Entertainment and Multimedia Computing' },
  { abbr: 'BSEE',     full: 'Bachelor of Science in Electrical Engineering' },
  { abbr: 'BSECE',    full: 'Bachelor of Science in Electronics and Communications Engineering' },
  { abbr: 'BSME',     full: 'Bachelor of Science in Mechanical Engineering' },
  { abbr: 'BSCIVIL',  full: 'Bachelor of Science in Civil Engineering' },
  { abbr: 'BSIE',     full: 'Bachelor of Science in Industrial Engineering' },
  { abbr: 'BSAE',     full: 'Bachelor of Science in Aeronautical Engineering' },
  { abbr: 'BSCHE',    full: 'Bachelor of Science in Chemical Engineering' },
  { abbr: 'BSGE',     full: 'Bachelor of Science in Geodetic Engineering' },
  { abbr: 'BSBA',     full: 'Bachelor of Science in Business Administration' },
  { abbr: 'BSBA-MM',  full: 'Bachelor of Science in Business Administration major in Marketing Management' },
  { abbr: 'BSBA-FM',  full: 'Bachelor of Science in Business Administration major in Financial Management' },
  { abbr: 'BSBA-HRM', full: 'Bachelor of Science in Business Administration major in Human Resource Management' },
  { abbr: 'BSBA-OM',  full: 'Bachelor of Science in Business Administration major in Operations Management' },
  { abbr: 'BSMA',     full: 'Bachelor of Science in Management Accounting' },
  { abbr: 'BSA',      full: 'Bachelor of Science in Accountancy' },
  { abbr: 'BSAIS',    full: 'Bachelor of Science in Accounting Information Systems' },
  { abbr: 'BSENT',    full: 'Bachelor of Science in Entrepreneurship' },
  { abbr: 'BSHRM',    full: 'Bachelor of Science in Hotel and Restaurant Management' },
  { abbr: 'BSTM',     full: 'Bachelor of Science in Tourism Management' },
  { abbr: 'BEED',     full: 'Bachelor of Elementary Education' },
  { abbr: 'BSED',     full: 'Bachelor of Secondary Education' },
  { abbr: 'BSED-ENG', full: 'Bachelor of Secondary Education major in English' },
  { abbr: 'BSED-MATH',full: 'Bachelor of Secondary Education major in Mathematics' },
  { abbr: 'BSED-SCI', full: 'Bachelor of Secondary Education major in Science' },
  { abbr: 'BSED-FIL', full: 'Bachelor of Secondary Education major in Filipino' },
  { abbr: 'BSED-SS',  full: 'Bachelor of Secondary Education major in Social Studies' },
  { abbr: 'BPED',     full: 'Bachelor of Physical Education' },
  { abbr: 'BSPE',     full: 'Bachelor of Science in Physical Education' },
  { abbr: 'BSN',      full: 'Bachelor of Science in Nursing' },
  { abbr: 'BSMT',     full: 'Bachelor of Science in Medical Technology' },
  { abbr: 'BSPT',     full: 'Bachelor of Science in Physical Therapy' },
  { abbr: 'BSOT',     full: 'Bachelor of Science in Occupational Therapy' },
  { abbr: 'BSND',     full: 'Bachelor of Science in Nutrition and Dietetics' },
  { abbr: 'BSPHAR',   full: 'Bachelor of Science in Pharmacy' },
  { abbr: 'BSRT',     full: 'Bachelor of Science in Radiologic Technology' },
  { abbr: 'BSMLS',    full: 'Bachelor of Science in Medical Laboratory Science' },
  { abbr: 'BSDENT',   full: 'Bachelor of Science in Dentistry' },
  { abbr: 'MD',       full: 'Doctor of Medicine' },
  { abbr: 'BSMATH',   full: 'Bachelor of Science in Mathematics' },
  { abbr: 'BSSTAT',   full: 'Bachelor of Science in Statistics' },
  { abbr: 'BSBIO',    full: 'Bachelor of Science in Biology' },
  { abbr: 'BSCHEM',   full: 'Bachelor of Science in Chemistry' },
  { abbr: 'BSPHYSICS',full: 'Bachelor of Science in Physics' },
  { abbr: 'BSENVSCI', full: 'Bachelor of Science in Environmental Science' },
  { abbr: 'BSAPMATH', full: 'Bachelor of Science in Applied Mathematics' },
  { abbr: 'ABCOMM',   full: 'Bachelor of Arts in Communication' },
  { abbr: 'ABENG',    full: 'Bachelor of Arts in English' },
  { abbr: 'ABFIL',    full: 'Bachelor of Arts in Filipino' },
  { abbr: 'ABSOCIO',  full: 'Bachelor of Arts in Sociology' },
  { abbr: 'ABPOLSCI', full: 'Bachelor of Arts in Political Science' },
  { abbr: 'ABPSYCH',  full: 'Bachelor of Arts in Psychology' },
  { abbr: 'BSPSYCH',  full: 'Bachelor of Science in Psychology' },
  { abbr: 'ABPHILO',  full: 'Bachelor of Arts in Philosophy' },
  { abbr: 'ABHISTORY',full: 'Bachelor of Arts in History' },
  { abbr: 'ABSOCWORK',full: 'Bachelor of Arts in Social Work' },
  { abbr: 'BSARCH',   full: 'Bachelor of Science in Architecture' },
  { abbr: 'BSID',     full: 'Bachelor of Science in Industrial Design' },
  { abbr: 'BSFA',     full: 'Bachelor of Science in Fine Arts' },
  { abbr: 'BSGD',     full: 'Bachelor of Science in Graphic Design' },
  { abbr: 'BSINTDES', full: 'Bachelor of Science in Interior Design' },
  { abbr: 'BSAGRI',   full: 'Bachelor of Science in Agriculture' },
  { abbr: 'BSFOR',    full: 'Bachelor of Science in Forestry' },
  { abbr: 'BSFISHERY',full: 'Bachelor of Science in Fisheries' },
  { abbr: 'BSAGRIBIZ',full: 'Bachelor of Science in Agribusiness' },
  { abbr: 'ABLAW',    full: 'Bachelor of Laws (Juris Doctor)' },
  { abbr: 'BSCRIM',   full: 'Bachelor of Science in Criminology' },
  { abbr: 'BSMC',     full: 'Bachelor of Science in Mass Communication' },
  { abbr: 'BSJOURNALISM', full: 'Bachelor of Science in Journalism' },
  { abbr: 'BSADVCOMM',full: 'Bachelor of Science in Advertising Communication' },
  { abbr: 'BSCUL',    full: 'Bachelor of Science in Culinary Arts' },
  { abbr: 'BSHOSP',   full: 'Bachelor of Science in Hospitality Management' },
  { abbr: 'BECED',    full: 'Bachelor of Early Childhood Education' },
  { abbr: 'BCAE',     full: 'Bachelor of Culture and Arts Education' },
];

@Component({
  selector: 'app-supervisor-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SupervisorSidenavComponent,
    SupervisorTopnavComponent
  ],
  templateUrl: './supervisor-tasks.component.html',
  styleUrls: ['./supervisor-tasks.component.css']
})
export class SupervisorTasksComponent implements OnInit {

  readonly Math = Math;
  readonly COURSE_LIST = COURSE_LIST;

  // ── Tabs ──────────────────────────────────────────────────
  activeTab: 'tasks' | 'logbook' = 'tasks';

  // ── Tasks state ───────────────────────────────────────────
  isModalOpen            = false;
  isCardModalOpen        = false;
  isSubmissionsModalOpen = false;
  loading                = false;
  editAttachmentLoading  = false;
  isCollapsed            = false;

  newSupervisorComment = '';
  supervisorCommentLoading = false;
  taskComments    : any[] = [];
  taskSubmissions : any[] = [];

  editingCommentId : string | null = null;
  editingMessage                   = '';
  internPhotoMap: { [userId: string]: string } = {};

  tasks          : Task[]   = [];
  allInterns     : Intern[] = [];
  filteredInterns: Intern[] = [];
  selectedInterns: Intern[] = [];
  internSearchQuery = '';

  taskScoreInput  : number | null = null;
  taskScoreSaving = false;

  assignMode: 'all' | 'course' | 'specific' = 'specific';

  selectedWeekMonday: string | null = null;
  // Add this property
allInternsMap: { [id: string]: { name: string; photo: string | null } } = {};

  // ── CREATE TASK: Course autocomplete ──────────────────────
  courseSearch         = '';
  filteredCourseList   : CourseOption[] = [];
  showCourseDropdown   = false;
  courseHighlightIndex = -1;
  selectedCourseObj    : CourseOption | null = null;
  selectedCourse       = '';   // ← FIXED: was missing
  private courseSelected = false;

  // ── EDIT TASK: Course autocomplete ────────────────────────
  editCourseSearch         = '';
  editFilteredCourseList   : CourseOption[] = [];
  editShowCourseDropdown   = false;
  editCourseHighlightIndex = -1;
  editSelectedCourseObj    : CourseOption | null = null;
  private editCourseSelected = false;

  // ── FIXED: courseOptions getter (was missing) ─────────────
  get courseOptions(): { label: string; full: string }[] {
    return COURSE_LIST.map(c => ({ label: c.abbr, full: c.full }));
  }

  taskSubmissionCountMap: { [taskId: string]: number } = {};

  selectedTask       : Task        = this.emptyTask();
  selectedFile       : File | null = null;
  attachmentFileName               = '';

  editAttachmentFile    : File | null = null;
  editAttachmentFileName              = '';

  currentSupervisorId = '';
  supervisorName      = '';

  // ── Tasks Pagination ──────────────────────────────────────
  currentPage = 1;
  pageSize    = 5;

  get totalPages(): number {
    return Math.ceil(this.tasks.length / this.pageSize);
  }
  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
  get pagedTasks(): Task[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.tasks.slice(start, start + this.pageSize);
  }
  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }
  get assignedCount(): number {
    return this.getAssignedIds(this.selectedTask).length;
  }
  get pendingCount(): number {
    const diff = this.assignedCount - this.taskSubmissions.length;
    return diff < 0 ? 0 : diff;
  }

  // ── EDIT TASK STATE ───────────────────────────────────────
  isEditModalOpen       = false;
  editLoading           = false;
  editTask              : Task        = this.emptyTask();
  editTaskOriginal      : Task | null = null;
  editNewAttachmentFile : File | null = null;
  editNewAttachmentFileName           = '';
  editAssignMode        : 'all' | 'course' | 'specific' = 'specific';
  editSelectedCourse    = '';
  editSelectedInterns   : Intern[] = [];
  editInternSearchQuery = '';
  editFilteredInterns   : Intern[] = [];

  get editEffectiveCourse(): string {
    if (this.editAssignMode !== 'course') return '';
    return this.editSelectedCourse;
  }

  get editCourseMatchedInterns(): Intern[] {
    const q = this.editEffectiveCourse.toLowerCase();
    if (!q) return [];
    return this.allInterns.filter(i =>
      i.course?.toLowerCase().includes(q) ||
      q.includes(i.course?.toLowerCase() ?? '') ||
      i.course?.toLowerCase() === q
    );
  }

  // ── Logbook state ─────────────────────────────────────────
  logbookInterns     : Intern[] = [];
  selectedInternId   : string   = '';
  selectedInternObj  : Intern | null = null;

  internLogbookEntries : LogbookEntry[] = [];
  logbookLoading       = false;

  isLogbookEntryModalOpen = false;
  selectedLogbookEntry    : LogbookEntry | null = null;
  logbookEntryPhotos      : LogbookPhoto[] = [];

  logbookModalPanel: 'entry' | 'report' = 'entry';

  scoringEntryId   : string | null = null;
  scoreInput       : number | null = null;
  scoreSaving      = false;

  reportWeekStart  = '';
  reportWeekEnd    = '';
  reportGenerating = false;

  internEntryCountMap: { [internId: string]: number } = {};
  internAvgScoreMap  : { [internId: string]: number | null } = {};

  logbookSearchQuery = '';
  filteredLogbookInterns: Intern[] = [];

  logbookCurrentPage = 1;
  logbookPageSize    = 10;

  get logbookTotalPages(): number {
    return Math.ceil(this.filteredLogbookInterns.length / this.logbookPageSize) || 1;
  }
  get logbookPageNumbers(): number[] {
    return Array.from({ length: this.logbookTotalPages }, (_, i) => i + 1);
  }
  get pagedLogbookInterns(): Intern[] {
    const start = (this.logbookCurrentPage - 1) * this.logbookPageSize;
    return this.filteredLogbookInterns.slice(start, start + this.logbookPageSize);
  }
  goToLogbookPage(page: number) {
    if (page < 1 || page > this.logbookTotalPages) return;
    this.logbookCurrentPage = page;
  }

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.getCurrentSupervisor();
    await this.loadAssignedInterns();
    await this.loadTasks();
    await this.loadInternPhotos();
    await this.loadAllInternEntryCounts();
  }

  switchTab(tab: 'tasks' | 'logbook') {
    this.activeTab = tab;
  }

  async getCurrentSupervisor() {
    try {
      const user = await this.appwrite.account.get();
      this.currentSupervisorId = user.$id;
      const doc = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID, this.appwrite.SUPERVISORS_COL, user.$id
      );
      this.supervisorName = `${(doc as any).first_name} ${(doc as any).last_name}`;
    } catch (error: any) {
      console.error('Failed to get supervisor:', error.message);
    }
  }

  async loadAssignedInterns() {
  try {
    const [studentsRes, archivesRes] = await Promise.all([
      this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL,
        [Query.limit(500)]
      ),
      this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, this.appwrite.ARCHIVES_COL,
        [Query.limit(500)]
      )
    ]);

    // Active interns for task assignment
    this.allInterns = (studentsRes.documents as any[]).filter(
      s => s.supervisor_id === this.currentSupervisorId
    );
    this.filteredInterns        = [...this.allInterns];
    this.logbookInterns         = [...this.allInterns];
    this.filteredLogbookInterns = [...this.allInterns];

    // Build a combined map (active + archived) for name/photo resolution
    this.allInternsMap = {};

    (studentsRes.documents as any[]).forEach(s => {
      this.allInternsMap[s.$id] = {
        name : `${s.first_name} ${s.last_name}`,
        photo: s.profile_photo_id ?? null
      };
    });

    // Archived interns — keyed by student_doc_id (their original $id)
    (archivesRes.documents as any[]).forEach(s => {
      const key = s.student_doc_id || s.$id;
      if (!this.allInternsMap[key]) {
        this.allInternsMap[key] = {
          name : `${s.first_name} ${s.last_name}`,
          photo: s.profile_photo_id ?? null
        };
      }
    });

  } catch (error: any) {
    console.error('Failed to load interns:', error.message);
  }
}
  async loadAllInternEntryCounts() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, 'logbook_entries', [Query.limit(5000)]
      );
      this.internEntryCountMap = {};
      const scoreMap: { [id: string]: number[] } = {};
      (res.documents as any[]).forEach(e => {
        if (!this.allInterns.find(i => i.$id === e.student_id)) return;
        this.internEntryCountMap[e.student_id] = (this.internEntryCountMap[e.student_id] || 0) + 1;
        if (e.score !== null && e.score !== undefined) {
          if (!scoreMap[e.student_id]) scoreMap[e.student_id] = [];
          scoreMap[e.student_id].push(e.score);
        }
      });
      this.internAvgScoreMap = {};
      this.allInterns.forEach(i => {
        const s = scoreMap[i.$id];
        this.internAvgScoreMap[i.$id] = s?.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
      });
    } catch { }
  }

  onLogbookSearch() {
    const q = this.logbookSearchQuery.toLowerCase();
    this.filteredLogbookInterns = this.logbookInterns.filter(i =>
      `${i.first_name} ${i.last_name}`.toLowerCase().includes(q)
    );
    this.logbookCurrentPage = 1;
  }

  async loadTasks() {
    try {
      const [tasksRes, subsRes] = await Promise.all([
        this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID, this.appwrite.TASKS_COL,
          [Query.limit(500)]
        ),
        this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL,
          [Query.limit(5000)]
        )
      ]);
      const allSubs = subsRes.documents as any[];
      this.taskSubmissionCountMap = {};
      const taskSubMap: { [taskId: string]: Set<string> } = {};
      allSubs.forEach(sub => {
        if (!taskSubMap[sub.task_id]) taskSubMap[sub.task_id] = new Set();
        taskSubMap[sub.task_id].add(sub.student_id);
      });
      Object.keys(taskSubMap).forEach(taskId => {
        this.taskSubmissionCountMap[taskId] = taskSubMap[taskId].size;
      });
      this.tasks = (tasksRes.documents as any[])
        .filter(task => task.supervisor_id === this.currentSupervisorId)
        .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime());
    } catch (error: any) {
      console.error('Failed to load tasks:', error.message);
    }
  }

  getDueDateParts(due: string) {
    const d = new Date(due);
    if (isNaN(d.getTime())) return { day: '', num: due, month: '' };
    return {
      day:   d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      num:   d.getDate().toString(),
      month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    };
  }

  // ── Course matching helper ────────────────────────────────
// AFTER
private internMatchesCourse(intern: Intern, searchTerm: string): boolean {
  if (!searchTerm) return false;
  const q       = searchTerm.toLowerCase().trim();
  const iCourse = (intern.course ?? '').toLowerCase().trim();
  if (!iCourse) return false;

  // Direct substring match
  if (iCourse.includes(q) || q.includes(iCourse)) return true;

  // Match via COURSE_LIST: find all entries whose abbr or full matches the search,
  // then check if the intern's stored course matches any of those entries' full names or abbrs
  const matchedOptions = COURSE_LIST.filter(c =>
    c.abbr.toLowerCase().includes(q) ||
    c.full.toLowerCase().includes(q) ||
    q.includes(c.abbr.toLowerCase()) ||
    q === c.abbr.toLowerCase()
  );
  return matchedOptions.some(c =>
    iCourse === c.full.toLowerCase() ||
    iCourse === c.abbr.toLowerCase() ||
    iCourse.includes(c.abbr.toLowerCase()) ||
    c.full.toLowerCase().includes(iCourse)
  );
}
  get effectiveCourse(): string {
    if (this.assignMode !== 'course') return '';
    return this.selectedCourseObj?.full ?? this.courseSearch.trim();
  }

 get courseMatchedInterns(): Intern[] {
  const term = this.selectedCourseObj
    ? this.selectedCourseObj.full   // ← use full name when selected from dropdown
    : this.courseSearch.trim();
  if (!term) return [];
  const q = term.toLowerCase();
  return this.allInterns.filter(i => this.internMatchesCourse(i, q));
}
  // ── CREATE: Course autocomplete handlers ─────────────────
  onCourseSearchInput() {
    this.courseSelected    = false;
    this.selectedCourseObj = null;
    const q = this.courseSearch.trim().toLowerCase();
    if (!q) {
      this.filteredCourseList  = [];
      this.showCourseDropdown  = false;
      return;
    }
    this.filteredCourseList = COURSE_LIST.filter(c =>
      c.abbr.toLowerCase().includes(q) || c.full.toLowerCase().includes(q)
    ).slice(0, 8);
    this.courseHighlightIndex = -1;
    this.showCourseDropdown   = true;
  }

  onCourseSearchFocus() {
    if (this.courseSearch.trim()) {
      this.showCourseDropdown = this.filteredCourseList.length > 0;
    }
  }

  onCourseSearchBlur() {
    setTimeout(() => {
      this.showCourseDropdown = false;
    }, 180);
  }

  onCourseSearchKeydown(event: KeyboardEvent) {
    if (!this.showCourseDropdown || !this.filteredCourseList.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.courseHighlightIndex = Math.min(this.courseHighlightIndex + 1, this.filteredCourseList.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.courseHighlightIndex = Math.max(this.courseHighlightIndex - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.courseHighlightIndex >= 0) this.selectCourseOption(this.filteredCourseList[this.courseHighlightIndex]);
    } else if (event.key === 'Escape') {
      this.showCourseDropdown = false;
    }
  }

  selectCourseOption(c: CourseOption) {
    this.selectedCourseObj    = c;
    this.courseSearch         = c.abbr;
    this.selectedCourse       = c.full;   // ← keep selectedCourse in sync
    this.courseSelected       = true;
    this.showCourseDropdown   = false;
    this.courseHighlightIndex = -1;
  }

  onCourseDropdownChange() {
    // Sync selectedCourseObj when the legacy dropdown is used
    const found = COURSE_LIST.find(c => c.full === this.selectedCourse);
    this.selectedCourseObj = found ?? null;
    if (found) this.courseSearch = found.abbr;
  }

  // ── EDIT: Course autocomplete handlers ───────────────────
  onEditCourseSearchInput() {
    this.editCourseSelected    = false;
    this.editSelectedCourseObj = null;
    const q = this.editCourseSearch.trim().toLowerCase();
    if (!q) {
      this.editFilteredCourseList  = [];
      this.editShowCourseDropdown  = false;
      return;
    }
    this.editFilteredCourseList = COURSE_LIST.filter(c =>
      c.abbr.toLowerCase().includes(q) || c.full.toLowerCase().includes(q)
    ).slice(0, 8);
    this.editCourseHighlightIndex = -1;
    this.editShowCourseDropdown   = true;
  }

  onEditCourseSearchFocus() {
    if (this.editCourseSearch.trim()) {
      this.editShowCourseDropdown = this.editFilteredCourseList.length > 0;
    }
  }

  onEditCourseSearchBlur() {
    setTimeout(() => { this.editShowCourseDropdown = false; }, 180);
  }

  onEditCourseSearchKeydown(event: KeyboardEvent) {
    if (!this.editShowCourseDropdown || !this.editFilteredCourseList.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.editCourseHighlightIndex = Math.min(this.editCourseHighlightIndex + 1, this.editFilteredCourseList.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.editCourseHighlightIndex = Math.max(this.editCourseHighlightIndex - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.editCourseHighlightIndex >= 0) this.selectEditCourseOption(this.editFilteredCourseList[this.editCourseHighlightIndex]);
    } else if (event.key === 'Escape') {
      this.editShowCourseDropdown = false;
    }
  }

  selectEditCourseOption(c: CourseOption) {
    this.editSelectedCourseObj    = c;
    this.editCourseSearch         = c.abbr;
    this.editSelectedCourse       = c.full;
    this.editCourseSelected       = true;
    this.editShowCourseDropdown   = false;
    this.editCourseHighlightIndex = -1;
  }

  onEditCourseDropdownChange() {
    const found = COURSE_LIST.find(c => c.full === this.editSelectedCourse);
    this.editSelectedCourseObj = found ?? null;
    if (found) this.editCourseSearch = found.abbr;
  }

 get editCourseMatchedInternsComputed(): Intern[] {
  const obj  = this.editSelectedCourseObj;
  const term = obj ? obj.full : this.editCourseSearch.trim();  // ← use full name
  if (!term) return [];
  const q = term.toLowerCase();
  return this.allInterns.filter(i => this.internMatchesCourse(i, q));
}

  onAssignModeChange() {
    this.courseSearch         = '';
    this.selectedCourse       = '';
    this.selectedCourseObj    = null;
    this.filteredCourseList   = [];
    this.showCourseDropdown   = false;
    this.selectedInterns      = [];
    this.internSearchQuery    = '';
    this.filteredInterns      = [...this.allInterns];
  }

  // ══════════════════════════════════════════════
  //  EDIT TASK METHODS
  // ══════════════════════════════════════════════

  openEditModal(task: Task) {
    this.editTask              = { ...task };
    this.editTaskOriginal      = task;
    this.editNewAttachmentFile = null;
    this.editNewAttachmentFileName = '';
    this.editInternSearchQuery = '';
    this.editFilteredInterns   = [...this.allInterns];
    this.editCourseSearch      = '';
    this.editSelectedCourseObj = null;
    this.editFilteredCourseList = [];
    this.editShowCourseDropdown = false;

    const assignedIds = this.getAssignedIds(task);
    if (assignedIds.length === this.allInterns.length && this.allInterns.length > 0) {
      this.editAssignMode      = 'all';
      this.editSelectedInterns = [...this.allInterns];
    } else {
      this.editAssignMode      = 'specific';
      this.editSelectedInterns = this.allInterns.filter(i => assignedIds.includes(i.$id));
    }
    this.editSelectedCourse = '';
    this.isEditModalOpen    = true;
    document.body.style.overflow = 'hidden';
  }

  closeEditModal() {
    this.isEditModalOpen           = false;
    this.editNewAttachmentFile     = null;
    this.editNewAttachmentFileName = '';
    this.editCourseSearch          = '';
    this.editSelectedCourseObj     = null;
    document.body.style.overflow   = '';
  }

  onEditTaskFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    this.editNewAttachmentFile     = file;
    this.editNewAttachmentFileName = file?.name ?? '';
  }

  onEditAssignModeChange() {
    this.editSelectedCourse       = '';
    this.editCourseSearch         = '';
    this.editSelectedCourseObj    = null;
    this.editFilteredCourseList   = [];
    this.editShowCourseDropdown   = false;
    this.editSelectedInterns      = [];
    this.editInternSearchQuery    = '';
    this.editFilteredInterns      = [...this.allInterns];
  }

  onEditInternSearch() {
    const q = this.editInternSearchQuery.toLowerCase();
    this.editFilteredInterns = this.allInterns.filter(i =>
      `${i.first_name} ${i.last_name}`.toLowerCase().includes(q)
    );
  }

  isEditSelected(intern: Intern): boolean {
    return this.editSelectedInterns.some(i => i.$id === intern.$id);
  }

  toggleEditIntern(intern: Intern) {
    if (this.isEditSelected(intern)) {
      this.editSelectedInterns = this.editSelectedInterns.filter(i => i.$id !== intern.$id);
    } else {
      this.editSelectedInterns.push(intern);
    }
  }

  async onSaveEditTask() {
    if (!this.editTask.title?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Missing title', text: 'Please enter a task title.', confirmButtonColor: '#0818A8' }); return;
    }
    if (!this.editTask.due) {
      Swal.fire({ icon: 'warning', title: 'Missing due date', text: 'Please set a due date.', confirmButtonColor: '#0818A8' }); return;
    }
    const editMatched = this.editCourseMatchedInternsComputed;
    if (this.editAssignMode === 'course' && !this.editCourseSearch.trim()) {
      Swal.fire({ icon: 'warning', title: 'No course selected', text: 'Please search and select a course.', confirmButtonColor: '#0818A8' }); return;
    }
    if (this.editAssignMode === 'course' && editMatched.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No matching interns', text: 'No interns found for that course.', confirmButtonColor: '#0818A8' }); return;
    }
    if (this.editAssignMode === 'specific' && this.editSelectedInterns.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No interns selected', text: 'Please select at least one intern.', confirmButtonColor: '#0818A8' }); return;
    }

    this.editLoading = true;
    try {
      let attachmentFileId   = this.editTask.attachment_file_id   ?? '';
      let attachmentFileName = this.editTask.attachment_file_name ?? '';

      if (this.editNewAttachmentFile) {
        if (attachmentFileId) {
          try { await this.appwrite.storage.deleteFile(this.BUCKET_ID, attachmentFileId); } catch { }
        }
        const uploaded = await this.appwrite.storage.createFile(
          this.BUCKET_ID, ID.unique(), this.editNewAttachmentFile
        );
        attachmentFileId   = uploaded.$id;
        attachmentFileName = this.editNewAttachmentFile.name;
      }

      let assignedIds = '';
      if (this.editAssignMode === 'all') {
        assignedIds = this.allInterns.map(i => i.$id).join(',');
      } else if (this.editAssignMode === 'course') {
        assignedIds = editMatched.map(i => i.$id).join(',');
      } else {
        assignedIds = this.editSelectedInterns.map(i => i.$id).join(',');
      }

      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID, this.appwrite.TASKS_COL, this.editTask.$id!,
        {
          title: this.editTask.title.trim(),
          description: this.editTask.description,
          due: this.editTask.due,
          assigned_intern_ids: assignedIds,
          attachment_file_id: attachmentFileId,
          attachment_file_name: attachmentFileName
        }
      );

      const idx = this.tasks.findIndex(t => t.$id === this.editTask.$id);
      if (idx !== -1) {
        this.tasks[idx] = {
          ...this.tasks[idx],
          title: this.editTask.title.trim(),
          description: this.editTask.description,
          due: this.editTask.due,
          assigned_intern_ids: assignedIds,
          attachment_file_id: attachmentFileId,
          attachment_file_name: attachmentFileName
        };
        this.tasks = [...this.tasks];
      }

      this.closeEditModal();
      Swal.fire({
        icon: 'success', title: 'Task Updated!',
        text: `"${this.editTask.title}" has been updated successfully.`,
        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to update', text: error.message });
    } finally {
      this.editLoading = false;
    }
  }

  // ── Logbook methods ───────────────────────────────────────
  async openInternLogbook(intern: Intern) {
    this.selectedWeekMonday = null;
    this.selectedInternId  = intern.$id;
    this.selectedInternObj = intern;
    this.logbookLoading    = true;
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, 'logbook_entries', [Query.limit(5000)]
      );
      this.internLogbookEntries = (res.documents as any[])
        .filter(e => e.student_id === intern.$id)
        .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
    } catch (e: any) { console.error('loadLogbook:', e.message); }
    finally { this.logbookLoading = false; }
  }

  closeInternLogbook() {
    this.selectedInternId = ''; this.selectedInternObj = null;
    this.internLogbookEntries = []; this.scoringEntryId = null; this.scoreInput = null;
  }

  async openLogbookEntryModal(entry: LogbookEntry) {
    this.selectedLogbookEntry    = entry;
    this.logbookEntryPhotos      = [];
    this.logbookModalPanel       = 'entry';
    this.scoreInput              = entry.score ?? null;
    this.isLogbookEntryModalOpen = true;

    if (entry.$id) {
      try {
        const res = await this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID, 'logbook_photos', [Query.limit(500)]
        );
        this.logbookEntryPhotos = (res.documents as any[]).filter(p => p.entry_id === entry.$id);
      } catch (e) {
        this.logbookEntryPhotos = [];
      }
    }
  }

  closeLogbookEntryModal() {
    this.isLogbookEntryModalOpen = false;
    this.selectedLogbookEntry    = null;
    this.logbookEntryPhotos      = [];
    this.scoreInput              = null;
  }

  async openLogbookEntry(entry: LogbookEntry) {
    await this.openLogbookEntryModal(entry);
  }

  startScoring(entry: LogbookEntry) {
    this.scoringEntryId = entry.$id ?? null;
    this.scoreInput     = entry.score ?? null;
  }

  cancelScoring() {
    this.scoringEntryId = null;
    this.scoreInput     = null;
  }

  async saveScore(entry: LogbookEntry) {
    if (this.scoreInput === null || this.scoreInput === undefined || this.scoreInput < 0 || this.scoreInput > 100) {
      Swal.fire({ icon: 'warning', title: 'Invalid score', text: 'Score must be 0–100.', confirmButtonColor: '#0818A8' });
      return;
    }
    this.scoreSaving = true;
    try {
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID, 'logbook_entries', entry.$id!, { score: this.scoreInput }
      );
      const idx = this.internLogbookEntries.findIndex(e => e.$id === entry.$id);
      if (idx !== -1) {
        this.internLogbookEntries[idx] = { ...this.internLogbookEntries[idx], score: this.scoreInput };
        this.internLogbookEntries = [...this.internLogbookEntries];
      }
      if (this.selectedLogbookEntry?.$id === entry.$id) {
        this.selectedLogbookEntry = { ...this.selectedLogbookEntry, score: this.scoreInput } as LogbookEntry;
      }
      await this.loadAllInternEntryCounts();
      Swal.fire({ icon: 'success', title: 'Score saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Failed', text: e.message });
    } finally {
      this.scoreSaving = false;
    }
  }

  async saveScoreFromModal() { if (this.selectedLogbookEntry) await this.saveScore(this.selectedLogbookEntry); }

  async saveTaskScore() {
    if (this.taskScoreInput === null || this.taskScoreInput === undefined) return;
    if (this.taskScoreInput < 0 || this.taskScoreInput > 100) {
      Swal.fire({ icon: 'warning', title: 'Invalid score', text: 'Score must be between 0 and 100.', confirmButtonColor: '#0818A8' }); return;
    }
    if (!this.selectedTask.$id) return;
    this.taskScoreSaving = true;
    try {
      const submissionsToScore = this.taskSubmissions.filter(s => s.task_id === this.selectedTask.$id);
      if (submissionsToScore.length === 0) {
        Swal.fire({ icon: 'warning', title: 'No submissions yet', text: 'There are no submissions to score for this task.', confirmButtonColor: '#0818A8' }); return;
      }
      await Promise.all(
        submissionsToScore.map(sub =>
          this.appwrite.databases.updateDocument(
            this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL, sub.$id!, { score: this.taskScoreInput }
          )
        )
      );
      this.taskSubmissions.forEach(sub => {
        if (sub.task_id === this.selectedTask.$id) { sub.score = this.taskScoreInput; sub._scoreInput = this.taskScoreInput; }
      });
      Swal.fire({ icon: 'success', title: 'Submission score(s) saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to save score', text: error.message });
    } finally { this.taskScoreSaving = false; }
  }

  getScoreDisplay(score: number | null | undefined): { label: string; cls: string; icon: string } {
    if (score === null || score === undefined) return { label: 'Not scored', cls: 'score-pending', icon: 'fas fa-hourglass-half' };
    if (score >= 90) return { label: `${score}/100`, cls: 'score-excellent', icon: 'fas fa-star' };
    if (score >= 75) return { label: `${score}/100`, cls: 'score-good',      icon: 'fas fa-check-circle' };
    if (score >= 60) return { label: `${score}/100`, cls: 'score-average',   icon: 'fas fa-minus-circle' };
    return                  { label: `${score}/100`, cls: 'score-low',       icon: 'fas fa-exclamation-circle' };
  }

  getAverageScore(entries: LogbookEntry[]): number | null {
    const s = entries.filter(e => e.score !== null && e.score !== undefined);
    return s.length ? Math.round(s.reduce((a, e) => a + (e.score ?? 0), 0) / s.length) : null;
  }
  getScoredCount(entries: LogbookEntry[]) { return entries.filter(e => e.score !== null && e.score !== undefined).length; }

  getThisWeekCount(entries: LogbookEntry[]) {
    const now = new Date(), day = now.getDay();
    const start = new Date(now); start.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); start.setHours(0,0,0,0);
    return entries.filter(e => new Date(e.entry_date) >= start).length;
  }

  getBulletItems(text: string) {
    if (!text) return [];
    return text.split('\n').map(l => l.replace(/^•\s*/, '').trim()).filter(l => l.length > 0);
  }

  formatEntryDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatLongDate(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  isToday(dateStr: string) { return new Date(dateStr).toDateString() === new Date().toDateString(); }
  getTimeOnly(createdAt: string) {
    if (!createdAt) return '';
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const m = createdAt.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    return m ? m[1] : createdAt;
  }
  getHeadline(text: string) {
    if (!text) return '';
    const first = text.split('\n')[0].split('.')[0].trim();
    const words = first.split(' ');
    return words.length > 9 ? words.slice(0, 9).join(' ') + '…' : first;
  }

  // ── Weekly Report PDF ─────────────────────────────────────
  async generateWeeklyReport() {
    if (!this.selectedInternObj) {
      Swal.fire({ icon: 'warning', title: 'No intern selected', text: 'Please select an intern first.', confirmButtonColor: '#0818A8' }); return;
    }
    if (!this.reportWeekStart || !this.reportWeekEnd) {
      Swal.fire({ icon: 'warning', title: 'Select a date range', text: 'Please enter the week start and end dates.', confirmButtonColor: '#0818A8' }); return;
    }
    this.reportGenerating = true;
    try {
      const start = new Date(this.reportWeekStart);
      const end   = new Date(this.reportWeekEnd);
      end.setHours(23, 59, 59, 999);

      const weekEntries = this.internLogbookEntries.filter(e => {
        const d = new Date(e.entry_date); return d >= start && d <= end;
      });
      if (weekEntries.length === 0) {
        Swal.fire({ icon: 'info', title: 'No entries found', text: 'No logbook entries for the selected range.', confirmButtonColor: '#0818A8' });
        this.reportGenerating = false; return;
      }

      const sortedEntries = [...weekEntries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
      const allPhotosRes  = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, 'logbook_photos', [Query.limit(500)]
      );
      const allPhotos     = allPhotosRes.documents as any[];
      const entryIds      = new Set(sortedEntries.map(e => e.$id));
      const rangePhotos   = allPhotos.filter(p => entryIds.has(p.entry_id) && p.student_id === this.selectedInternObj!.$id);

      const toBase64 = (url: string): Promise<string> =>
        fetch(url).then(r => r.blob()).then(blob => new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string); reader.onerror = rej; reader.readAsDataURL(blob);
        }));

      interface PhotoItem { b64: string; name: string; entryDate: string; uploadedAt: string; }
      const photoMap: Record<string, PhotoItem[]> = {};
      await Promise.allSettled(rangePhotos.map(async (photo) => {
        try {
          const b64 = await toBase64(this.getPhotoUrl(photo.file_id));
          const entry = sortedEntries.find(e => e.$id === photo.entry_id);
          const entryDate = entry ? new Date(entry.entry_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
          if (!photoMap[photo.entry_id]) photoMap[photo.entry_id] = [];
          photoMap[photo.entry_id].push({ b64, name: photo.file_name, entryDate, uploadedAt: photo.uploaded_at || '' });
        } catch { }
      }));

      const internName    = `${this.selectedInternObj!.first_name} ${this.selectedInternObj!.last_name}`;
      const totalEntries  = sortedEntries.length;
      const avgScore      = this.getAverageScore(sortedEntries);
      const weekLabel     = `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      const allPhotoItems: PhotoItem[] = [];
      for (const entry of sortedEntries) allPhotoItems.push(...(photoMap[entry.$id!] || []));

      const rows = sortedEntries.map(e => {
        const scoreDisp = e.score !== null && e.score !== undefined
          ? `<span style="font-weight:700;color:${e.score >= 75 ? '#15803d' : e.score >= 60 ? '#d97706' : '#dc2626'}">${e.score}/100</span>`
          : '<span style="color:#aaa;">—</span>';
        const photoCount = (photoMap[e.$id!] || []).length;
        return `<tr>
          <td class="col-date">
            <div class="date-day">${new Date(e.entry_date).toLocaleDateString('en-US', { weekday: 'long' })}</div>
            <div class="date-full">${new Date(e.entry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            ${photoCount > 0 ? `<div style="font-size:9px;color:#0818A8;margin-top:4px;">📷 ${photoCount} photo${photoCount > 1 ? 's' : ''}</div>` : ''}
          </td>
          <td class="col-tasks">${e.tasks_done.replace(/\n/g, '<br>')}</td>
          <td class="col-reflect">${e.reflection ? e.reflection.replace(/\n/g, '<br>') : '<span style="color:#aaa;">—</span>'}</td>
          <td class="col-score" style="text-align:center;">${scoreDisp}</td>
        </tr>`;
      }).join('');

      const page1 = document.createElement('div');
      page1.id = '__sv-pdf-page1';
      page1.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:"Segoe UI",Arial,sans-serif;font-size:11px;color:#1a1a2e;padding:20px 40px 20px 40px;box-sizing:border-box;';
      page1.innerHTML = `
        <style>
          #__sv-pdf-page1 table tbody tr { border-bottom:1px solid #e2e8f0; }
          #__sv-pdf-page1 table tbody tr:nth-child(even) { background:#f8fafc; }
          #__sv-pdf-page1 table tbody td { padding:8px 10px; vertical-align:top; line-height:1.5; }
          #__sv-pdf-page1 .date-day  { font-weight:700; font-size:10px; color:#0818A8; }
          #__sv-pdf-page1 .date-full { font-size:9px; color:#64748b; margin-top:2px; }
        </style>
        <div style="text-align:center;padding-bottom:14px;border-bottom:3px solid #0818A8;margin-bottom:4px;">
          <div style="font-size:15px;font-weight:700;color:#1e293b;">Weekly OJT Accomplishment Report</div>
          <div style="font-size:10px;color:#64748b;margin-top:3px;">On-the-Job Training Program &nbsp;·&nbsp; Supervisor Review</div>
        </div>
        <div style="height:4px;background:linear-gradient(90deg,#0818A8 0%,#060f7a 50%,#6366f1 100%);margin-bottom:14px;border-radius:0 0 4px 4px;"></div>
        <div style="display:flex;margin-bottom:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <div style="flex:1;padding:8px 14px;border-right:1px solid #e2e8f0;background:#0818A8;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#a5b4fc;margin-bottom:2px;">Intern Name</div>
            <div style="font-size:11px;font-weight:600;color:#fff;">${internName}</div>
          </div>
          <div style="flex:1;padding:8px 14px;border-right:1px solid #e2e8f0;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:2px;">Supervisor</div>
            <div style="font-size:11px;font-weight:600;color:#1e293b;">${this.supervisorName}</div>
          </div>
          <div style="flex:1;padding:8px 14px;border-right:1px solid #e2e8f0;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:2px;">Report Period</div>
            <div style="font-size:11px;font-weight:600;color:#1e293b;">${weekLabel}</div>
          </div>
          <div style="flex:1;padding:8px 14px;border-right:1px solid #e2e8f0;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:2px;">Total Days</div>
            <div style="font-size:11px;font-weight:600;color:#1e293b;">${totalEntries} day${totalEntries !== 1 ? 's' : ''}</div>
          </div>
          <div style="flex:1;padding:8px 14px;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:2px;">Avg Score</div>
            <div style="font-size:11px;font-weight:600;color:#1e293b;">${avgScore !== null ? avgScore + '/100' : 'Not yet scored'}</div>
          </div>
        </div>
        <div style="font-size:11px;font-weight:700;color:#0818A8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;border-bottom:1px solid #e2e8f0;padding-bottom:5px;">Daily Accomplishments</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#0818A8;">
              <th style="width:18%;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:8px 10px;text-align:left;">Date</th>
              <th style="width:44%;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:8px 10px;text-align:left;">Tasks / Accomplishments</th>
              <th style="width:28%;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:8px 10px;text-align:left;">Reflections</th>
              <th style="width:10%;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:8px 10px;text-align:center;">Score</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
      document.body.appendChild(page1);

      Swal.fire({ title: 'Generating PDF…', html: '<p style="font-size:13px;color:#6b7280;">Please wait while your report is being prepared.</p>', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
      await new Promise(r => setTimeout(r, 200));

      const canvas1 = await html2canvas(page1, {
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false,
        width: 794, height: page1.scrollHeight, windowWidth: 794
      });

      const A4_W = 210; const A4_H = 297; const MARGIN_TOP = 15; const MARGIN_BOT = 5;
      const CONTENT_H = A4_H - MARGIN_TOP - MARGIN_BOT;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

      const addCanvasWithMargins = (canvas: HTMLCanvasElement, isFirstPage: boolean) => {
        const pxPerMm = canvas.width / A4_W;
        const slicePx = Math.round(CONTENT_H * pxPerMm);
        const mTopPx  = Math.round(MARGIN_TOP * pxPerMm);
        let srcY = 0; let first = isFirstPage;
        while (srcY < canvas.height) {
          if (!first) pdf.addPage();
          first = false;
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width  = canvas.width;
          pageCanvas.height = Math.round(A4_H * pxPerMm);
          const ctx = pageCanvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          const srcH = Math.min(slicePx, canvas.height - srcY);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, mTopPx, canvas.width, srcH);
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, A4_W, A4_H);
          srcY += srcH;
        }
      };
      addCanvasWithMargins(canvas1, true);

      if (allPhotoItems.length > 0) {
        const photoRowsHtml = (() => {
          let html = '';
          for (let i = 0; i < allPhotoItems.length; i += 2) {
            const a = allPhotoItems[i]; const b = allPhotoItems[i + 1];
            html += `<div style="display:flex;gap:14px;margin-bottom:14px;align-items:flex-start;">`;
            html += `<div style="flex:1;min-width:0;"><img src="${a.b64}" style="width:100%;border-radius:6px;border:1px solid #e2e8f0;display:block;max-height:200px;object-fit:cover;"><div style="font-size:9px;color:#0818A8;font-weight:600;margin-top:4px;">${a.entryDate}</div><div style="font-size:8px;color:#94a3b8;margin-top:1px;">${a.name}</div>${a.uploadedAt ? `<div style="font-size:8px;color:#c4b5fd;margin-top:1px;">⏱ ${a.uploadedAt}</div>` : ''}</div>`;
            if (b) { html += `<div style="flex:1;min-width:0;"><img src="${b.b64}" style="width:100%;border-radius:6px;border:1px solid #e2e8f0;display:block;max-height:200px;object-fit:cover;"><div style="font-size:9px;color:#0818A8;font-weight:600;margin-top:4px;">${b.entryDate}</div><div style="font-size:8px;color:#94a3b8;margin-top:1px;">${b.name}</div>${b.uploadedAt ? `<div style="font-size:8px;color:#c4b5fd;margin-top:1px;">⏱ ${b.uploadedAt}</div>` : ''}</div>`; }
            else { html += `<div style="flex:1;"></div>`; }
            html += `</div>`;
          }
          return html;
        })();
        const page2 = document.createElement('div');
        page2.id = '__sv-pdf-page2';
        page2.style.cssText = 'position:fixed;left:-9999px;top:0;width:714px;background:#fff;font-family:"Segoe UI",Arial,sans-serif;font-size:11px;color:#1a1a2e;padding:20px 40px;box-sizing:border-box;';
        page2.innerHTML = `<div style="text-align:center;border-bottom:2px solid #0818A8;padding-bottom:10px;margin-bottom:14px;"><div style="font-size:13px;font-weight:700;color:#1e293b;">Photo Evidence</div><div style="font-size:10px;color:#64748b;margin-top:2px;">${internName} — Visual documentation of daily OJT activities</div></div>${photoRowsHtml}`;
        document.body.appendChild(page2);
        const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false, width: 714, height: page2.scrollHeight, windowWidth: 714 });
        addCanvasWithMargins(canvas2, false);
        document.body.removeChild(page2);
      }

      const pageSig = document.createElement('div');
      pageSig.id = '__sv-pdf-sig';
      pageSig.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:"Segoe UI",Arial,sans-serif;font-size:11px;color:#1a1a2e;padding:20px 60px;box-sizing:border-box;';
      pageSig.innerHTML = `
        <div style="text-align:center;border-bottom:2px solid #0818A8;padding-bottom:12px;margin-bottom:40px;">
          <div style="font-size:13px;font-weight:700;color:#1e293b;">Certification &amp; Approval</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px;">Authorized signatories for this accomplishment report</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:80px;margin-bottom:60px;">
          <div style="flex:1;text-align:center;"><div style="height:48px;border-bottom:1.5px solid #1e293b;margin-bottom:8px;"></div><div style="font-size:11px;font-weight:700;color:#1e293b;">${this.supervisorName}</div><div style="font-size:9px;color:#64748b;margin-top:3px;">OJT Supervisor</div></div>
          <div style="flex:1;text-align:center;"><div style="height:48px;border-bottom:1.5px solid #1e293b;margin-bottom:8px;"></div><div style="font-size:11px;font-weight:700;color:#1e293b;">OCES Admin</div><div style="font-size:9px;color:#64748b;margin-top:3px;">School OJT Coordinator</div></div>
        </div>
        <div style="margin-top:32px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:9px;color:#94a3b8;">Generated on ${generatedDate} &nbsp;·&nbsp; Confidential – For Official Use Only</div>
          <div style="font-size:9px;color:#0818A8;font-weight:600;">OJTify · Olongapo City Elementary School</div>
        </div>`;
      document.body.appendChild(pageSig);
      const canvasSig = await html2canvas(pageSig, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false, width: 794, height: pageSig.scrollHeight, windowWidth: 794 });
      addCanvasWithMargins(canvasSig, false);
      document.body.removeChild(pageSig);
      document.body.removeChild(page1);

      const fileName = `OJT-Report-${internName.replace(/\s+/g, '-')}-${this.reportWeekStart}.pdf`;
      pdf.save(fileName);
      Swal.fire({ icon: 'success', title: 'Downloaded!', text: `Saved as ${fileName}`, confirmButtonColor: '#0818A8', timer: 2500, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Report failed', text: error.message });
    } finally {
      this.reportGenerating = false;
      ['__sv-pdf-page1', '__sv-pdf-page2', '__sv-pdf-sig'].forEach(id => document.getElementById(id)?.remove());
    }
  }

  // ── Task methods ──────────────────────────────────────────
  onInternSearch() {
    const q = this.internSearchQuery.toLowerCase();
    this.filteredInterns = this.allInterns.filter(i =>
      `${i.first_name} ${i.last_name}`.toLowerCase().includes(q)
    );
  }

  onToggleSidebar(collapsed: boolean) { this.isCollapsed = collapsed; }

  isSelected(intern: Intern): boolean { return this.selectedInterns.some(i => i.$id === intern.$id); }

  toggleIntern(intern: Intern) {
    if (this.isSelected(intern)) {
      this.selectedInterns = this.selectedInterns.filter(i => i.$id !== intern.$id);
    } else {
      this.selectedInterns.push(intern);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    this.selectedFile       = file;
    this.attachmentFileName = file?.name ?? '';
  }

  onEditFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    this.editAttachmentFile     = file;
    this.editAttachmentFileName = file?.name ?? '';
  }

  async uploadEditAttachment() {
    if (!this.editAttachmentFile || !this.selectedTask.$id) return;
    this.editAttachmentLoading = true;
    try {
      if (this.selectedTask.attachment_file_id) {
        try { await this.appwrite.storage.deleteFile(this.BUCKET_ID, this.selectedTask.attachment_file_id); } catch { }
      }
      const uploaded = await this.appwrite.storage.createFile(this.BUCKET_ID, ID.unique(), this.editAttachmentFile);
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID, this.appwrite.TASKS_COL, this.selectedTask.$id,
        { attachment_file_id: uploaded.$id, attachment_file_name: this.editAttachmentFile.name }
      );
      this.selectedTask.attachment_file_id   = uploaded.$id;
      this.selectedTask.attachment_file_name = this.editAttachmentFile.name;
      const index = this.tasks.findIndex(t => t.$id === this.selectedTask.$id);
      if (index !== -1) { this.tasks[index].attachment_file_id = uploaded.$id; this.tasks[index].attachment_file_name = this.editAttachmentFile.name; }
      this.editAttachmentFile = null; this.editAttachmentFileName = '';
      Swal.fire({ icon: 'success', title: 'Attachment Updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Upload Failed', text: error.message });
    } finally { this.editAttachmentLoading = false; }
  }

  async removeAttachment() {
    if (!this.selectedTask.attachment_file_id || !this.selectedTask.$id) return;
    const result = await Swal.fire({ title: 'Remove attachment?', text: 'This will permanently delete the attached file.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, remove it', cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280' });
    if (!result.isConfirmed) return;
    try {
      await this.appwrite.storage.deleteFile(this.BUCKET_ID, this.selectedTask.attachment_file_id);
      await this.appwrite.databases.updateDocument(this.appwrite.DATABASE_ID, this.appwrite.TASKS_COL, this.selectedTask.$id, { attachment_file_id: '', attachment_file_name: '' });
      this.selectedTask.attachment_file_id = ''; this.selectedTask.attachment_file_name = '';
      const index = this.tasks.findIndex(t => t.$id === this.selectedTask.$id);
      if (index !== -1) { this.tasks[index].attachment_file_id = ''; this.tasks[index].attachment_file_name = ''; }
      this.editAttachmentFile = null; this.editAttachmentFileName = '';
      Swal.fire({ icon: 'success', title: 'Attachment Removed!', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to remove', text: error.message }); }
  }

  openModal() {
    this.selectedTask       = this.emptyTask();
    this.selectedFile       = null;
    this.attachmentFileName = '';
    this.selectedInterns    = [];
    this.internSearchQuery  = '';
    this.filteredInterns    = [...this.allInterns];
    this.assignMode         = 'specific';
    this.courseSearch       = '';
    this.selectedCourse     = '';
    this.selectedCourseObj  = null;
    this.filteredCourseList = [];
    this.showCourseDropdown = false;
    this.isModalOpen        = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal() { this.isModalOpen = false; document.body.style.overflow = ''; }

  openCardModal(task: Task) {
    const assignedIds     = this.getAssignedIds(task);
    const assignedInterns = assignedIds.map(id => {
      const intern = this.allInterns.find(i => i.$id === id);
      return { name: intern ? `${intern.first_name} ${intern.last_name}` : id, img: '' };
    });
    this.selectedTask = { ...task, assignedInterns, comments: [], submissions: [] };
    this.taskScoreInput = task.score ?? null;
    this.editAttachmentFile = null; this.editAttachmentFileName = '';
    this.newSupervisorComment = ''; this.taskComments = []; this.taskSubmissions = [];
    this.editingCommentId = null; this.editingMessage = ''; this.isCardModalOpen = true;
    document.body.style.overflow = 'hidden';
    if (task.$id) { this.loadTaskComments(task.$id); this.loadTaskSubmissions(task.$id); }
  }

  closeCardModal() {
    this.isCardModalOpen = false; this.editAttachmentFile = null; this.editAttachmentFileName = '';
    this.newSupervisorComment = ''; this.taskComments = []; this.taskSubmissions = [];
    this.editingCommentId = null; this.editingMessage = ''; document.body.style.overflow = '';
    this.taskScoreInput = null;
  }

  openSubmissionsModal()  { this.isSubmissionsModalOpen = true; }
  closeSubmissionsModal() { this.isSubmissionsModalOpen = false; }

  async onCreateTask() {
    if (!this.selectedTask.title || !this.selectedTask.due) {
      Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'Please fill in the title and due date.', confirmButtonColor: '#0818A8' }); return;
    }
    if (this.assignMode === 'course') {
      if (!this.courseSearch.trim()) {
        Swal.fire({ icon: 'warning', title: 'No course entered', text: 'Please search and select a course.', confirmButtonColor: '#0818A8' }); return;
      }
      if (this.courseMatchedInterns.length === 0) {
        Swal.fire({ icon: 'warning', title: 'No matching interns', text: `No interns found for that course.`, confirmButtonColor: '#0818A8' }); return;
      }
    }
    if (this.assignMode === 'specific' && this.selectedInterns.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No interns selected', text: 'Please select at least one intern.', confirmButtonColor: '#0818A8' }); return;
    }

    this.loading = true;
    try {
      let attachmentFileId = '', attachmentFileName = '';
      if (this.selectedFile) {
        const uploaded = await this.appwrite.storage.createFile(this.BUCKET_ID, ID.unique(), this.selectedFile);
        attachmentFileId = uploaded.$id; attachmentFileName = this.selectedFile.name;
      }

      let assignedIds = '';
      if (this.assignMode === 'all') {
        assignedIds = this.allInterns.map(i => i.$id).join(',');
      } else if (this.assignMode === 'course') {
        assignedIds = this.courseMatchedInterns.map(i => i.$id).join(',');
      } else {
        assignedIds = this.selectedInterns.map(i => i.$id).join(',');
      }

      const doc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID, this.appwrite.TASKS_COL, ID.unique(),
        {
          title: this.selectedTask.title,
          description: this.selectedTask.description,
          posted: new Date().toLocaleString(),
          due: this.selectedTask.due,
          status: 'pending',
          assigned_intern_ids: assignedIds,
          attachment_file_id: attachmentFileId,
          attachment_file_name: attachmentFileName,
          supervisor_id: this.currentSupervisorId,
          supervisor_name: this.supervisorName
        }
      );
      this.tasks.unshift(doc as any); this.currentPage = 1; this.closeModal();
      Swal.fire({ icon: 'success', title: 'Task Created!', text: `"${doc['title']}" has been created successfully.`, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed', text: error.message }); }
    finally { this.loading = false; }
  }

  async deleteTask(task: Task, event: Event) {
    event.stopPropagation();
    const result = await Swal.fire({
      title: 'Delete task?', text: `"${task.title}" will be permanently deleted.`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Yes, delete it', cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280'
    });
    if (!result.isConfirmed) return;
    try {
      if (task.attachment_file_id) { try { await this.appwrite.storage.deleteFile(this.BUCKET_ID, task.attachment_file_id); } catch { } }
      await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, this.appwrite.TASKS_COL, task.$id!);
      this.tasks = this.tasks.filter(t => t.$id !== task.$id);
      if (this.isCardModalOpen) this.closeCardModal();
      if (this.currentPage > this.totalPages && this.totalPages > 0) this.currentPage = this.totalPages;
      Swal.fire({ icon: 'success', title: 'Task Deleted!', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message }); }
  }

 async loadTaskComments(taskId: string) {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL,
      [Query.limit(500)]
    );

    this.taskComments = (res.documents as any[])
      .filter(c => c.task_id === taskId)
      .filter(c => {
        if (c.role === 'supervisor') return true;
        return this.allInterns.some(i => i.$id === c.user_id); // ← only active interns
      })
      .sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());

  } catch (error: any) {
    console.error('Failed to load comments:', error.message);
  }
}

  async loadTaskSubmissions(taskId: string) {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL,
      [Query.limit(500)]
    );

    this.taskSubmissions = (res.documents as any[])
      .filter(s => s.task_id === taskId)
      .map(sub => {
        // Check active interns first, then archived map
        const internFromActive = this.allInterns.find(i => i.$id === sub.student_id);
        const internFromMap    = this.allInternsMap[sub.student_id];

        const studentName    = internFromActive
          ? `${internFromActive.first_name} ${internFromActive.last_name}`
          : internFromMap?.name ?? null;

        const profilePhotoId = internFromActive?.profile_photo_id
          ?? (internFromMap?.photo ?? null);

        // Skip submissions from fully unknown interns (not in any collection)
        if (!studentName) return null;

        return {
          ...sub,
          student_name    : studentName,
          profile_photo_id: profilePhotoId,
          score           : sub.score ?? null,
          _scoreInput     : sub.score ?? null,
          _scoreSaving    : false
        } as Submission;
      })
      .filter(Boolean); // ← removes null (unknown/deleted interns)

  } catch (e: any) {
    console.error('loadSubmissions:', e.message);
  }
} 

  async saveSubmissionScore(sub: Submission) {
    if (sub._scoreInput === null || sub._scoreInput === undefined) return;
    if (sub._scoreInput < 0 || sub._scoreInput > 100) {
      Swal.fire({ icon: 'warning', title: 'Invalid score', text: 'Score must be between 0 and 100.', confirmButtonColor: '#0818A8' }); return;
    }
    sub._scoreSaving = true;
    try {
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL, sub.$id!, { score: sub._scoreInput }
      );
      sub.score = sub._scoreInput;
      Swal.fire({ icon: 'success', title: 'Score saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Failed to save score', text: e.message });
    } finally { sub._scoreSaving = false; }
  }

  async sendSupervisorComment() {
    if (!this.newSupervisorComment.trim() || !this.selectedTask.$id) return;
    this.supervisorCommentLoading = true;
    try {
      const user = await this.appwrite.account.get();
      const doc  = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL, ID.unique(),
        { task_id: this.selectedTask.$id, user_id: user.$id, user_name: this.supervisorName || user.name || user.email, role: 'supervisor', message: this.newSupervisorComment.trim(), created_at: new Date().toLocaleString() }
      );
      this.taskComments.push(doc as any); this.newSupervisorComment = '';
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to send', text: error.message }); }
    finally { this.supervisorCommentLoading = false; }
  }

  startEditComment(comment: any) { this.editingCommentId = comment.$id; this.editingMessage = comment.message; }
  cancelEditComment() { this.editingCommentId = null; this.editingMessage = ''; }

  async saveEditComment(comment: any) {
    if (!this.editingMessage.trim()) return;
    try {
      await this.appwrite.databases.updateDocument(this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL, comment.$id, { message: this.editingMessage.trim() });
      const index = this.taskComments.findIndex(c => c.$id === comment.$id);
      if (index !== -1) this.taskComments[index] = { ...this.taskComments[index], message: this.editingMessage.trim() };
      this.cancelEditComment();
      Swal.fire({ icon: 'success', title: 'Comment updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to update', text: error.message }); }
  }

  async deleteSupervisorComment(comment: any) {
    const result = await Swal.fire({ title: 'Delete comment?', text: 'This action cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280' });
    if (!result.isConfirmed) return;
    try {
      await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL, comment.$id);
      this.taskComments = this.taskComments.filter(c => c.$id !== comment.$id);
      Swal.fire({ icon: 'success', title: 'Comment deleted!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message }); }
  }

  emptyTask(): Task {
    return { title: '', description: '', posted: new Date().toLocaleString(), due: '', status: 'pending', assigned_intern_ids: '', attachment_file_id: '', attachment_file_name: '', assignedInterns: [], comments: [], submissions: [], score: null };
  }

  getAssignedIds(task: Task): string[] {
    if (!task.assigned_intern_ids) return [];
    return task.assigned_intern_ids.split(',').filter(id => id.trim());
  }

  getInternName(id: string): string {
    const intern = this.allInterns.find(i => i.$id === id);
    return intern ? `${intern.first_name} ${intern.last_name}` : id;
  }

  getInitials(fullName: string): string {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }

  getFileUrl(fileId: string, mode: 'view' | 'download' = 'view'): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/${mode}?project=${this.PROJECT_ID}`;
  }

 async loadInternPhotos() {
  // internPhotoMap is now built from allInternsMap — no extra query needed
  this.internPhotoMap = {};
  Object.entries(this.allInternsMap).forEach(([id, data]) => {
    if (data.photo) this.internPhotoMap[id] = data.photo;
  });
}

  getCommentPhotoUrl(userId: string): string | null {
    const photoId = this.internPhotoMap[userId];
    if (!photoId) return null;
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${photoId}/view?project=${this.PROJECT_ID}`;
  }

  getTaskAssignedCount(task: Task): number { return this.getAssignedIds(task).length; }
  getTaskSubmittedCount(task: Task): number { return this.taskSubmissionCountMap[task.$id ?? ''] ?? 0; }

  getPhotoUrl(fileId: string): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=${this.PROJECT_ID}`;
  }

  getInternProfileUrl(intern: Intern): string | null {
    if (!intern.profile_photo_id) return null;
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${intern.profile_photo_id}/view?project=${this.PROJECT_ID}`;
  }

  getWeekRanges(entries: LogbookEntry[]): { label: string; monday: string; count: number }[] {
    const weekMap: { [k: string]: number } = {};
    entries.forEach(e => {
      const key = this.getMondayOf(e.entry_date);
      weekMap[key] = (weekMap[key] || 0) + 1;
    });
    return Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        const mon = new Date(key + 'T00:00:00');
        const fri = new Date(mon);
        fri.setDate(mon.getDate() + 4);
        const label = mon.getMonth() === fri.getMonth()
          ? `${mon.toLocaleDateString('en-US', { month: 'short' })} ${mon.getDate()}–${fri.getDate()}`
          : `${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${fri.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        return { label, monday: key, count };
      });
  }

  getWeekDays(monday: string): { date: string; dayName: string; dayNum: number; entry: LogbookEntry | null; isToday: boolean }[] {
    const today = new Date().toISOString().slice(0, 10);
    const eMap: { [d: string]: LogbookEntry } = {};
    this.internLogbookEntries.forEach(e => eMap[e.entry_date] = e);
    const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday + 'T00:00:00');
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      return { date: key, dayName: dayLabels[i], dayNum: d.getDate(), entry: eMap[key] ?? null, isToday: key === today };
    });
  }

  getWeekLogged(monday: string): number { return this.getWeekDays(monday).filter(d => d.entry).length; }
  getWeekMissed(monday: string): number { return 5 - this.getWeekLogged(monday); }

  getWeekAvgScore(monday: string): number | null {
    const scored = this.getWeekDays(monday).filter(d => d.entry?.score !== null && d.entry?.score !== undefined);
    return scored.length ? Math.round(scored.reduce((a, d) => a + (d.entry!.score ?? 0), 0) / scored.length) : null;
  }

  get filteredWeekEntries(): LogbookEntry[] {
    if (!this.selectedWeekMonday) return this.internLogbookEntries;
    const mon = new Date(this.selectedWeekMonday + 'T00:00:00');
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
    const fridayKey = fri.toISOString().slice(0, 10);
    return this.internLogbookEntries.filter(e =>
      e.entry_date >= this.selectedWeekMonday! && e.entry_date <= fridayKey
    );
  }

  getDayEntries(monday: string): (LogbookEntry | null)[] {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday + 'T00:00:00');
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      return this.internLogbookEntries.find(e => e.entry_date === key) ?? null;
    });
  }

  onWeekFilterChange() {}

  private getMondayOf(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dow = d.getDay();
    let diff = 0;
    if (dow === 0) diff = 1;
    else if (dow === 6) diff = 2;
    else diff = 1 - dow;
    d.setDate(d.getDate() + diff);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}