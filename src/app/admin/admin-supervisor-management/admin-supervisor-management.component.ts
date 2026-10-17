import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { FormsModule }        from '@angular/forms';
import { RouterModule }       from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent }  from '../admin-topnav/admin-topnav.component';
import { AppwriteService }       from '../../services/appwrite.service';
import { ID }                    from 'appwrite';
import { environment }             from '../../../environments/environment';

interface Supervisor {
  $id              : string;
  first_name       : string;
  last_name        : string;
  employee_id     ?: string;
  email            : string;
  grade_level     ?: string;
  status          ?: string;
  assigned_students?: number;
  profile_photo_id ?: string;
  esig_file_id    ?: string;
  $createdAt       : string;
}

interface Intern {
  $id             : string;
  first_name      : string;
  last_name       : string;
  email          ?: string;
  school_name         ?: string;
  course         ?: string;
  status         ?: string;
  supervisor_id  ?: string;
  profile_photo_id?: string;
  completed_hours ?: number;
  required_hours  ?: number;
}

interface SupervisorForm {
  first_name  : string;
  last_name   : string;
  employee_id : string;
  email       : string;
  password    : string;
  grade_level : string;
}

interface PasswordChecks {
  minLength  : boolean;
  hasUpper   : boolean;
  hasNumber  : boolean;
  hasSpecial : boolean;
}

const DUMMY_SUPERVISORS: Supervisor[] = [
  { $id: '1', first_name: 'Maria',  last_name: 'Santos',     employee_id: 'EMP-001', email: 'maria.santos@ojtify.edu',     grade_level: 'Grade 3', status: 'Active',   assigned_students: 3,  $createdAt: '2024-06-01' },
  { $id: '2', first_name: 'Jose',   last_name: 'Reyes',      employee_id: 'EMP-002', email: 'jose.reyes@ojtify.edu',      grade_level: 'Grade 5', status: 'Active',   assigned_students: 2,  $createdAt: '2024-06-03' },
  { $id: '3', first_name: 'Ana',    last_name: 'Cruz',       employee_id: 'EMP-003', email: 'ana.cruz@ojtify.edu',        grade_level: 'Grade 1', status: 'Inactive', assigned_students: 0,  $createdAt: '2024-06-05' },
  { $id: '4', first_name: 'Ramon',  last_name: 'Dela Torre', employee_id: 'EMP-004', email: 'ramon.delatorre@ojtify.edu', grade_level: 'Grade 4', status: 'Inactive', assigned_students: 1,  $createdAt: '2024-06-07' },
  { $id: '5', first_name: 'Liza',   last_name: 'Navarro',    employee_id: 'EMP-005', email: 'liza.navarro@ojtify.edu',    grade_level: 'Grade 6', status: 'Active',   assigned_students: 2,  $createdAt: '2024-06-09' },
  { $id: '6', first_name: 'Carlo',  last_name: 'Mendoza',    employee_id: 'EMP-006', email: 'carlo.mendoza@ojtify.edu',   grade_level: 'Grade 2', status: 'Active',   assigned_students: 2,  $createdAt: '2024-06-11' },
  { $id: '7', first_name: 'Tricia', last_name: 'Villanueva', employee_id: 'EMP-007', email: 'tricia.v@ojtify.edu',        grade_level: 'Grade 5', status: 'Active',   assigned_students: 1,  $createdAt: '2024-06-13' },
];

const DUMMY_INTERNS: Record<string, Intern[]> = {
  '1': [
    { $id: 'i1', first_name: 'Kevin',   last_name: 'Reyes',    school_name: 'PLM',  course: 'BSIT',   status: 'Active',   supervisor_id: '1', completed_hours: 240, required_hours: 500 },
    { $id: 'i2', first_name: 'Jasmine', last_name: 'Bautista', school_name: 'TUP',  course: 'BSCS',   status: 'Active',   supervisor_id: '1', completed_hours: 380, required_hours: 500 },
    { $id: 'i3', first_name: 'Mark',    last_name: 'Ong',      school_name: 'DLSU', course: 'BS ECE', status: 'Inactive', supervisor_id: '1', completed_hours: 100, required_hours: 500 },
  ],
  '2': [
    { $id: 'i4', first_name: 'Carla',  last_name: 'Dizon',  school_name: 'UST',  course: 'BSCS',    status: 'Active',  supervisor_id: '2', completed_hours: 450, required_hours: 500 },
    { $id: 'i5', first_name: 'Nathan', last_name: 'Flores', school_name: 'AdMU', course: 'BS Math', status: 'Pending', supervisor_id: '2', completed_hours: 60,  required_hours: 500 },
  ],
  '4': [
    { $id: 'i6', first_name: 'Lea', last_name: 'Torres', school_name: 'MAPUA', course: 'BSCE', status: 'Active', supervisor_id: '4', completed_hours: 300, required_hours: 500 },
  ],
  '5': [
    { $id: 'i7', first_name: 'Gio', last_name: 'Valdez',  school_name: 'FEU', course: 'BSIT', status: 'Active', supervisor_id: '5', completed_hours: 200, required_hours: 500 },
    { $id: 'i8', first_name: 'Ria', last_name: 'Mercado', school_name: 'PUP', course: 'BSCS', status: 'Active', supervisor_id: '5', completed_hours: 490, required_hours: 500 },
  ],
  '6': [
    { $id: 'i9',  first_name: 'Paolo', last_name: 'Aguilar', school_name: 'DLSU',   course: 'BSIT', status: 'Active',   supervisor_id: '6', completed_hours: 150, required_hours: 500 },
    { $id: 'i10', first_name: 'Trish', last_name: 'Pascual', school_name: 'Ateneo', course: 'BSCS', status: 'Inactive', supervisor_id: '6', completed_hours: 320, required_hours: 500 },
  ],
  '7': [
    { $id: 'i11', first_name: 'Dan', last_name: 'Lim', school_name: 'TIP', course: 'BSECE', status: 'Active', supervisor_id: '7', completed_hours: 410, required_hours: 500 },
  ],
};

const DEFAULT_POSITIONS = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'
];

const POSITIONS_STORAGE_KEY = 'supervisor_position_options';

@Component({
  selector   : 'app-admin-supervisor-management',
  standalone : true,
  imports    : [CommonModule, FormsModule, RouterModule, AdminSidenavComponent, AdminTopnavComponent],
  templateUrl: './admin-supervisor-management.component.html',
  styleUrl   : './admin-supervisor-management.component.css'
})
export class AdminSupervisorManagementComponent implements OnInit {

  supervisors        : Supervisor[] = [];
  filteredSupervisors: Supervisor[] = [];
  loading            = false;
  isCollapsed        = false;
  isMobile = window.innerWidth < 768;


  showModal          = false;
  isEditing          = false;
  submitting         = false;
  formError          = '';
  editingId          = '';
  showPassword       = false;
  selectedSupervisor : Supervisor | null = null;

  showDeleteConfirm  = false;
  supervisorToDelete : Supervisor | null = null;

  form: SupervisorForm = this.emptyForm();

  activeTab: 'profile' | 'students' = 'profile';

  isAccountActive = true;

  internsLoading  = false;
  assignedInterns : Intern[] = [];

  showAssignModal = false;
  allInterns: Intern[] = [];
  filteredInterns: Intern[] = [];
  internsSearchQuery = '';
  assigningIntern = false;
    // ── Assign modal pagination ──
  assignPage     = 1;
  assignPageSize = 10;
  assignLoading  = false;
  assignFilter: 'all' | 'assigned' | 'unassigned' = 'all';

    get assignTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredInterns.length / this.assignPageSize));
  }

  get paginatedInterns(): Intern[] {
    const sorted = this.sortInternsByLastName(this.filteredInterns);
    const start  = (this.assignPage - 1) * this.assignPageSize;
    return sorted.slice(start, start + this.assignPageSize);
  }

  get assignShowingFrom(): number {
    return this.filteredInterns.length === 0 ? 0 : (this.assignPage - 1) * this.assignPageSize + 1;
  }

  get assignShowingTo(): number {
    return Math.min(this.assignPage * this.assignPageSize, this.filteredInterns.length);
  }

  changeAssignPage(p: number) {
    if (p >= 1 && p <= this.assignTotalPages) this.assignPage = p;
  }

  currentPage = 1;
  pageSize    = 10;
  realTotalAssignedInterns = 0;

  // ── Position / Role options ───────────────────────────────
  positionOptions         : string[] = [];
  newPositionInput        : string   = '';
  positionDropdownOpen    : boolean  = false;
  showDeletePositionConfirm: boolean = false;
  positionToDelete        : string   = '';
  // ─────────────────────────────────────────────────────────

  // ── Password strength checks ──────────────────────────────
  pwChecks: PasswordChecks = {
    minLength  : false,
    hasUpper   : false,
    hasNumber  : false,
    hasSpecial : false,
  };
  // ─────────────────────────────────────────────────────────

  readonly Math = Math;

  get ghostRows(): null[] {
    const empty = this.pageSize - this.paginatedSupervisors.length;
    return empty > 0 ? Array(empty).fill(null) : [];
  }

  esigPreviewUrl   = '';
  esigUploading    = false;

  readonly BUCKET_ID       = '69baaf64002ceb2490df';
  readonly PROJECT_ID      = '69ba8d9c0027d10c447f';
  readonly ENDPOINT        = 'https://sgp.cloud.appwrite.io/v1';
  readonly SUPERVISORS_COL = 'supervisors';
  readonly INTERNS_COL     = 'interns';
  private readonly OTP_FUNCTION_ID = '69edb8fb00176781c74b';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    this.loadPositionOptions();
    await this.loadSupervisors();
    await this.loadTotalAssignedCount();
  }

  // ── Close dropdown when clicking outside ─────────────────
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.position-dropdown-wrap')) {
      this.positionDropdownOpen = false;
    }
  }

  // ── Position dropdown methods ─────────────────────────────

  togglePositionDropdown(): void {
    this.positionDropdownOpen = !this.positionDropdownOpen;
  }

  selectPosition(opt: string): void {
    this.form.grade_level    = opt;
    this.positionDropdownOpen = false;
  }

  confirmDeletePosition(opt: string): void {
    this.positionToDelete          = opt;
    this.showDeletePositionConfirm = true;
    // Don't close the dropdown so user sees context, but close after confirm opens
    this.positionDropdownOpen      = false;
  }

  // ── Position / Role management ────────────────────────────

  private loadPositionOptions(): void {
    try {
      const stored = localStorage.getItem(POSITIONS_STORAGE_KEY);
      this.positionOptions = stored ? JSON.parse(stored) : [...DEFAULT_POSITIONS];
    } catch {
      this.positionOptions = [...DEFAULT_POSITIONS];
    }
  }

  private savePositionOptions(): void {
    try {
      localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(this.positionOptions));
    } catch { /* ignore quota errors */ }
  }

  addPositionOption(): void {
    const val = this.newPositionInput.trim();
    if (!val) return;

    const duplicate = this.positionOptions.some(
      o => o.toLowerCase() === val.toLowerCase()
    );
    if (duplicate) {
      this.newPositionInput = '';
      return;
    }

    this.positionOptions = [...this.positionOptions, val];
    this.savePositionOptions();
    this.newPositionInput = '';
  }

  removePositionOption(opt: string): void {
    this.positionOptions = this.positionOptions.filter(o => o !== opt);
    if (this.form.grade_level === opt) {
      this.form.grade_level = '';
    }
    this.savePositionOptions();
    this.showDeletePositionConfirm = false;
    this.positionToDelete          = '';
  }

  // ─────────────────────────────────────────────────────────

  // ── Password validation ───────────────────────────────────

  onPasswordChange(): void {
    const pw = this.form.password;
    this.pwChecks = {
      minLength  : pw.length >= 8,
      hasUpper   : pw.length > 0 && pw[0] === pw[0].toUpperCase() && /[A-Z]/.test(pw[0]),
      hasNumber  : /\d/.test(pw),
      hasSpecial : /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw),
    };
  }

  isPasswordValid(): boolean {
    return this.pwChecks.minLength &&
           this.pwChecks.hasUpper  &&
           this.pwChecks.hasNumber &&
           this.pwChecks.hasSpecial;
  }

  // ─────────────────────────────────────────────────────────

    async loadTotalAssignedCount() {
    try {
      const docs = await this.fetchAllDocuments(this.appwrite.STUDENTS_COL);
      this.realTotalAssignedInterns = docs
        .filter(s => s.supervisor_id && s.supervisor_id !== '').length;
    } catch (err: any) {
      console.error('Failed to count assigned interns:', err.message);
    }
  }

 async loadSupervisors() {
  this.loading = true;
  try {
    const { Query } = await import('appwrite');
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.SUPERVISORS_COL,
      [Query.limit(100)]
    );
    this.supervisors = this.sortAlphabetically(res.documents as any[]);
  } catch (err: any) {
    console.error('Failed to load supervisors:', err);
    this.supervisors = [];
  } finally {
    this.filteredSupervisors = [...this.supervisors];
    this.loading = false;
  }
}

  get totalAssignedInterns(): number {
    return this.supervisors.reduce((s, sup) => s + (sup.assigned_students || 0), 0);
  }

  get avgInternsPerSupervisor(): string {
    if (!this.supervisors.length) return '0';
    return (this.totalAssignedInterns / this.supervisors.length).toFixed(1);
  }

  get activeSupervisors(): number {
    return this.supervisors.filter(s => (s.status || 'Active') === 'Active').length;
  }

  onSearch(event: any) {
    const q = event.target.value.toLowerCase();
    this.filteredSupervisors = this.supervisors.filter(s =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      (s.email       || '').toLowerCase().includes(q)             ||
      (s.employee_id || '').toLowerCase().includes(q)             ||
      (s.grade_level || '').toLowerCase().includes(q)
    );
    this.currentPage = 1;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredSupervisors.length / this.pageSize));
  }

  get totalPagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedSupervisors(): Supervisor[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredSupervisors.slice(start, start + this.pageSize);
  }

  changePage(p: number) {
    if (p >= 1 && p <= this.totalPages) this.currentPage = p;
  }

  openViewModal(sup: Supervisor) {
    this.selectedSupervisor  = sup;
    this.isEditing           = false;
    this.formError           = '';
    this.showPassword        = false;
    this.activeTab           = 'profile';
    this.assignedInterns     = [];
    this.isAccountActive     = (sup.status || 'Active') === 'Active';
    this.newPositionInput    = '';
    this.positionDropdownOpen = false;
    this.form = {
      first_name  : sup.first_name,
      last_name   : sup.last_name,
      employee_id : sup.employee_id  || '',
      email       : sup.email,
      password    : '',
      grade_level : sup.grade_level  || '',
    };
    this.editingId = sup.$id;
    this.showModal = true;

    this.loadAssignedInterns();

    this.esigPreviewUrl = '';
    if (sup.esig_file_id) {
      this.loadEsigPreview(sup.esig_file_id);
    }
  }

  openAddModal() {
    this.selectedSupervisor  = null;
    this.isEditing           = false;
    this.editingId           = '';
    this.form                = this.emptyForm();
    this.formError           = '';
    this.showPassword        = false;
    this.assignedInterns     = [];
    this.newPositionInput    = '';
    this.positionDropdownOpen = false;
    this.pwChecks = { minLength: false, hasUpper: false, hasNumber: false, hasSpecial: false };
    this.showModal = true;
  }

  enableEdit() {
    this.newPositionInput    = '';
    this.positionDropdownOpen = false;
    this.isEditing           = true;
  }

  closeModal() {
    this.showModal           = false;
    this.isEditing           = false;
    this.selectedSupervisor  = null;
    this.formError           = '';
    this.assignedInterns     = [];
    this.newPositionInput    = '';
    this.positionDropdownOpen = false;
  }

  openDeleteConfirm() {
    this.supervisorToDelete = this.selectedSupervisor;
    this.showDeleteConfirm  = true;
  }

  async switchToStudentsTab() {
    this.activeTab = 'students';
    await this.loadAssignedInterns();
  }

  async loadAssignedInterns() {
    if (!this.selectedSupervisor) return;
    this.internsLoading = true;
    try {
      const { Query } = await import('appwrite');
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        [Query.equal('supervisor_id', this.selectedSupervisor.$id)]
      );
      this.assignedInterns = this.sortInternsByLastName(res.documents as any[]);

      const realCount = this.assignedInterns.length;
      this.selectedSupervisor = { ...this.selectedSupervisor, assigned_students: realCount };

      const idx = this.supervisors.findIndex(s => s.$id === this.selectedSupervisor!.$id);
      if (idx !== -1) this.supervisors[idx].assigned_students = realCount;

      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.SUPERVISORS_COL,
        this.selectedSupervisor.$id,
        { assigned_students: realCount }
      );

    } catch (err: any) {
      console.error('Failed to load assigned interns:', err.message);
      this.assignedInterns = [];
    } finally {
      this.internsLoading = false;
    }
  }

  async toggleAccountStatus() {
    if (!this.selectedSupervisor) return;
    const newStatus = this.isAccountActive ? 'Inactive' : 'Active';
    this.isAccountActive = !this.isAccountActive;

    const sup = this.supervisors.find(s => s.$id === this.selectedSupervisor!.$id);
    if (sup) sup.status = newStatus;
    if (this.selectedSupervisor) this.selectedSupervisor = { ...this.selectedSupervisor, status: newStatus };

    try {
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.SUPERVISORS_COL,
        this.selectedSupervisor!.$id,
        { status: newStatus }
      );
    } catch (err: any) {
      this.isAccountActive = !this.isAccountActive;
      const revertStatus = this.isAccountActive ? 'Active' : 'Inactive';
      if (sup) sup.status = revertStatus;
      console.error('Status update failed:', err.message);
    }
  }

 async submitForm() {
  this.formError = '';
 
  if (!this.form.first_name.trim() || !this.form.last_name.trim() || !this.form.email.trim()) {
    this.formError = 'First name, last name, and email are required.'; return;
  }
 
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(this.form.email.trim())) {
    this.formError = 'Please enter a valid email address.'; return;
  }
 
  if (!this.selectedSupervisor) {
    if (!this.form.password.trim()) {
      this.formError = 'Password is required when creating a new account.'; return;
    }
    if (!this.isPasswordValid()) {
      this.formError = 'Password does not meet the requirements. Please check the indicators below the password field.'; return;
    }
  }
 
  this.submitting = true;
  let createdAuthId = '';
 
  try {
    const email = this.form.email.trim().toLowerCase();
    const { Query } = await import('appwrite');
 
    // ── Duplicate checks (new accounts only) ──
    if (!this.selectedSupervisor) {
      const sup = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, this.SUPERVISORS_COL, [Query.equal('email', email)]);
      if (sup.documents.length > 0) {
        this.formError = 'A supervisor with this email is already registered.';
        return;
      }
 
      const stu = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL, [Query.equal('email', email)]);
      if (stu.documents.length > 0) {
        this.formError = 'This email is already registered as an OJT student account. Supervisors and students cannot share the same email.';
        return;
      }
    }
 
    const payload: any = {
      first_name  : this.form.first_name.trim(),
      last_name   : this.form.last_name.trim(),
      employee_id : this.form.employee_id.trim(),
      email,                                   // saved lowercased
      grade_level : this.form.grade_level,
      status      : 'Active',
    };
 
    if (this.selectedSupervisor) {
      // ── EDIT ──
      payload.status = this.selectedSupervisor.status || 'Active';
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID, this.SUPERVISORS_COL, this.editingId, payload);
    } else {
      // ── CREATE ──
      const account = await this.appwrite.account.create(
        ID.unique(), email, this.form.password,
        `${this.form.first_name.trim()} ${this.form.last_name.trim()}`);
      createdAuthId = account.$id;
 
      await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID, this.SUPERVISORS_COL, account.$id,
        { ...payload, assigned_students: 0 });
      createdAuthId = '';   // row saved successfully, nothing to roll back
 
      await this.sendSupervisorWelcomeEmail(
        email,
        `${this.form.first_name.trim()} ${this.form.last_name.trim()}`,
        this.form.password
      );
    }
 
    await this.loadSupervisors();
    this.closeModal();
 
  } catch (err: any) {
    console.error('submitForm failed:', err);
 
    // Roll back the orphaned Auth user if the row insert failed.
    // ⚠ ADJUST the body to whatever your DELETE_USER_FN expects.
    if (createdAuthId) {
      try {
        await this.appwrite.functions.createExecution(
          this.appwrite.DELETE_USER_FN,
          JSON.stringify({ userId: createdAuthId }),
          false
        );
      } catch (rollbackErr) {
        console.error('Rollback failed — delete this user manually in Auth:', createdAuthId, rollbackErr);
      }
    }
 
    this.formError = err.message || 'Something went wrong.';
  } finally {
    this.submitting = false;
  }
}

  async deleteSupervisor() {
    if (!this.supervisorToDelete) return;
    this.submitting = true;
    try {
      await this.appwrite.databases.deleteDocument(
        this.appwrite.DATABASE_ID, this.SUPERVISORS_COL, this.supervisorToDelete.$id);
      await this.loadSupervisors();
      this.showDeleteConfirm = false;
      this.closeModal();
    } catch (err: any) {
      console.error('Delete failed:', err.message);
    } finally { this.submitting = false; }
  }

  emptyForm(): SupervisorForm {
    return { first_name: '', last_name: '', employee_id: '', email: '', password: '', grade_level: '' };
  }

onToggleSidebar(c: boolean) {
  this.isMobile = window.innerWidth < 768;
  this.isCollapsed = this.isMobile ? false : c;
}
  getFullName(s: Supervisor)   { return `${s.first_name} ${s.last_name}`; }
  getInternFullName(i: Intern): string {
  const last  = (i.last_name  || '').trim();
  const first = (i.first_name || '').trim();   // includes middle name(s)

  if (!last) return first;      // no last name saved, show as is
  if (!first) return last;
  return `${last}, ${first}`;
}

  getAvatarUrl(s: Supervisor): string {
    if (s.profile_photo_id)
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${s.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    const initials = `${s.first_name.charAt(0)} ${s.last_name.charAt(0)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2563eb&color=fff&size=64`;
  }

  getInternAvatarUrl(i: Intern): string {
    if (i.profile_photo_id)
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${i.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    const initials = `${i.first_name.charAt(0)} ${i.last_name.charAt(0)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2563eb&color=fff&size=64`;
  }

  getInternProgress(intern: Intern): number {
    const completed = intern.completed_hours || 0;
    const required  = intern.required_hours  || 500;
    return Math.min(100, Math.round((completed / required) * 100));
  }

  getStatusClass(status: string | undefined): string {
    return status === 'Inactive' ? 'status-inactive' : 'status-active';
  }

async openAssignModal() {
  this.showAssignModal    = true;
  this.internsSearchQuery = '';
  this.assignFilter       = 'all';
  this.assignPage         = 1;
  this.assignLoading      = true;
  try {
    const docs      = await this.fetchAllDocuments(this.appwrite.STUDENTS_COL);
    this.allInterns = this.sortInternsByLastName(docs);
    this.applyInternFilters(true);
  } catch (err: any) {
    console.error('Failed to load interns:', err.message);
  } finally {
    this.assignLoading = false;
  }
}

  getInternSupervisorLabel(intern: Intern): string {
    const supId = (intern as any).supervisor_id;
    if (!supId) return '';
    if (supId === this.selectedSupervisor?.$id) return 'Already assigned to this supervisor';
    const sup = this.supervisors.find(s => s.$id === supId);
    return sup ? `Assigned to ${sup.first_name} ${sup.last_name}` : 'Assigned to another supervisor';
  }

  async assignIntern(intern: Intern) {
    if (!this.selectedSupervisor) return;
    const supId = (intern as any).supervisor_id;
    if (supId === this.selectedSupervisor.$id) return;

    this.assigningIntern = true;
    try {
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        intern.$id,
        { supervisor_id: this.selectedSupervisor.$id }
      );

      await this.loadAssignedInterns();
      await this.loadTotalAssignedCount();

      (intern as any).supervisor_id = this.selectedSupervisor.$id;
      this.applyInternFilters();
    } catch (err: any) {
      console.error('Failed to assign intern:', err.message);
    } finally {
      this.assigningIntern = false;
    }
  }

  async unassignIntern(intern: Intern) {
    if (!this.selectedSupervisor) return;
    this.assigningIntern = true;
    try {
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        intern.$id,
        { supervisor_id: null }
      );

      await this.loadAssignedInterns();
      await this.loadTotalAssignedCount();

      const idx = this.allInterns.findIndex(i => i.$id === intern.$id);
      if (idx !== -1) (this.allInterns[idx] as any).supervisor_id = null;
      this.applyInternFilters();

    } catch (err: any) {
      console.error('Failed to unassign intern:', err.message);
    } finally {
      this.assigningIntern = false;
    }
  }

  async sendSupervisorWelcomeEmail(email: string, fullName: string, password: string) {
    try {
      const execution = await this.appwrite.functions.createExecution(
        this.OTP_FUNCTION_ID,
        JSON.stringify({
          action:         'send-supervisor-welcome',
          email,
          supervisorName: fullName,
          password,
          templateId:     environment.brevoSupervisorWelcomeTid
        }),
        false
      );

      const result = JSON.parse(execution.responseBody);

      if (!result.success) {
        console.error('Supervisor welcome email failed:', result.message);
      } else {
        console.log(`Welcome email sent to ${email}`);
      }
    } catch (error) {
      console.error('Failed to send supervisor welcome email:', error);
    }
  }

  async onEsigChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.selectedSupervisor) return;

    if (file.type !== 'image/png') {
      const Swal = (await import('sweetalert2')).default;
      Swal.fire({
        icon: 'error',
        title: 'Invalid File Type',
        text: 'Only PNG files are accepted for e-signatures. Please upload a .png file.',
        confirmButtonColor: '#2563eb'
      });
      (event.target as HTMLInputElement).value = '';
      return;
    }

    await this.uploadEsig(file);
  }

  async onEsigDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file || !this.selectedSupervisor) return;

    if (file.type !== 'image/png') {
      const Swal = (await import('sweetalert2')).default;
      Swal.fire({
        icon: 'error',
        title: 'Invalid File Type',
        text: 'Only PNG files are accepted for e-signatures. Please drag a .png file.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    await this.uploadEsig(file);
  }

  private async uploadEsig(file: File): Promise<void> {
    if (!this.selectedSupervisor) return;

    if (file.type !== 'image/png') {
      const Swal = (await import('sweetalert2')).default;
      Swal.fire({
        icon: 'error',
        title: 'Invalid File Type',
        text: 'Only PNG files are accepted for e-signatures.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    this.esigUploading = true;

    try {
      const oldFileId = this.selectedSupervisor.esig_file_id;
      if (oldFileId) {
        try { await this.appwrite.storage.deleteFile(this.BUCKET_ID, oldFileId); }
        catch { /* ignore */ }
      }

      const { ID } = await import('appwrite');
      const newFileId = ID.unique();
      await this.appwrite.storage.createFile(this.BUCKET_ID, newFileId, file);

      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.SUPERVISORS_COL,
        this.selectedSupervisor.$id,
        { esig_file_id: newFileId }
      );

      this.selectedSupervisor = { ...this.selectedSupervisor, esig_file_id: newFileId };
      const idx = this.supervisors.findIndex(s => s.$id === this.selectedSupervisor!.$id);
      if (idx !== -1) this.supervisors[idx].esig_file_id = newFileId;

      const reader = new FileReader();
      reader.onloadend = () => { this.esigPreviewUrl = reader.result as string; };
      reader.readAsDataURL(file);

      const Swal = (await import('sweetalert2')).default;
      Swal.fire({
        icon: 'success', title: 'E-Signature Saved!',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 2000, timerProgressBar: true
      });

    } catch (err: any) {
      console.error('E-sig upload failed:', err);
      const Swal = (await import('sweetalert2')).default;
      Swal.fire({ icon: 'error', title: 'Upload Failed', text: err.message, confirmButtonColor: '#2563eb' });
    } finally {
      this.esigUploading = false;
    }
  }

  async removeEsig(): Promise<void> {
    if (!this.selectedSupervisor?.esig_file_id) return;

    try {
      await this.appwrite.storage.deleteFile(this.BUCKET_ID, this.selectedSupervisor.esig_file_id);
    } catch { /* ignore */ }

    await this.appwrite.databases.updateDocument(
      this.appwrite.DATABASE_ID,
      this.SUPERVISORS_COL,
      this.selectedSupervisor.$id,
      { esig_file_id: '' }
    );

    this.selectedSupervisor = { ...this.selectedSupervisor, esig_file_id: '' };
    const idx = this.supervisors.findIndex(s => s.$id === this.selectedSupervisor!.$id);
    if (idx !== -1) this.supervisors[idx].esig_file_id = '';
    this.esigPreviewUrl = '';
  }
getStrengthScore(): number {
  return Object.values(this.pwChecks).filter(Boolean).length;
}
  private async loadEsigPreview(fileId: string): Promise<void> {
    try {
      const jwt = await this.appwrite.account.createJWT();
      const url = `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=${this.PROJECT_ID}`;
      const res = await fetch(url, {
        headers: { 'X-Appwrite-JWT': jwt.jwt, 'X-Appwrite-Project': this.PROJECT_ID }
      });
      if (res.ok) {
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => { this.esigPreviewUrl = reader.result as string; };
        reader.readAsDataURL(blob);
      }
    } catch (err) {
      console.warn('Could not load esig preview:', err);
    }
  }

  private sortAlphabetically(list: Supervisor[]): Supervisor[] {
  return [...list].sort((a, b) =>
    `${a.first_name} ${a.last_name}`.localeCompare(
      `${b.first_name} ${b.last_name}`,
      undefined,
      { sensitivity: 'base' }
    )
  );
}
   private async fetchAllDocuments(collectionId: string, queries: string[] = []): Promise<any[]> {
    const { Query } = await import('appwrite');
    const all: any[] = [];
    const batchSize = 100;
    let lastId: string | null = null;

    while (true) {
      const q = [...queries, Query.limit(batchSize)];
      if (lastId) q.push(Query.cursorAfter(lastId));

      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, collectionId, q
      );
      all.push(...res.documents);

      if (res.documents.length < batchSize) break;
      lastId = res.documents[res.documents.length - 1].$id;
    }
    return all;
  }
      private getSortKey(i: Intern): string {
    let last = (i.last_name || '').trim();
    if (!last) {
      const parts = (i.first_name || '').trim().split(/\s+/);
      last = parts.length > 1 ? parts[parts.length - 1] : '';
    }
    return last;
  }

  private sortInternsByLastName(list: Intern[]): Intern[] {
    return [...list].sort((a, b) => {
      const la = this.getSortKey(a);
      const lb = this.getSortKey(b);

      // blank last names go to the bottom
      if (!la && lb) return 1;
      if (la && !lb) return -1;

      return (
        la.localeCompare(lb, 'en', { sensitivity: 'base' }) ||
        (a.first_name || '').trim().localeCompare((b.first_name || '').trim(), 'en', { sensitivity: 'base' })
      );
    });
  }
  onInternSearch(event: any) {
  this.internsSearchQuery = event.target.value.toLowerCase();
  this.applyInternFilters(true);
}

setAssignFilter(f: 'all' | 'assigned' | 'unassigned') {
  this.assignFilter = f;
  this.applyInternFilters(true);
}

get assignedCount(): number {
  return this.allInterns.filter(i => !!i.supervisor_id).length;
}

get unassignedCount(): number {
  return this.allInterns.filter(i => !i.supervisor_id).length;
}

// Single place that does search + filter + A–Z sort
applyInternFilters(resetPage = false) {
  const q = this.internsSearchQuery.trim().toLowerCase();

  const result = this.allInterns.filter(i => {
    const matchesSearch =
      !q ||
      `${i.first_name} ${i.last_name}`.toLowerCase().includes(q) ||
      (i.school_name || '').toLowerCase().includes(q) ||
      (i.course || '').toLowerCase().includes(q);

    const isAssigned = !!i.supervisor_id;
    const matchesFilter =
      this.assignFilter === 'all' ||
      (this.assignFilter === 'assigned' && isAssigned) ||
      (this.assignFilter === 'unassigned' && !isAssigned);

    return matchesSearch && matchesFilter;
  });

  this.filteredInterns = this.sortInternsByLastName(result); // always A–Z

  if (resetPage) {
    this.assignPage = 1;
  } else if (this.assignPage > this.assignTotalPages) {
    this.assignPage = this.assignTotalPages; // keep the page valid after changes
  }
}
}