import { Component, OnInit } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { FormsModule }        from '@angular/forms';
import { RouterModule }       from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent }  from '../admin-topnav/admin-topnav.component';
import { AppwriteService }       from '../../services/appwrite.service';
import { ID }                    from 'appwrite';

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
  $createdAt       : string;
}

interface Intern {
  $id             : string;
  first_name      : string;
  last_name       : string;
  email          ?: string;
  school         ?: string;
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
    { $id: 'i1', first_name: 'Kevin',   last_name: 'Reyes',    school: 'PLM',  course: 'BSIT',   status: 'Active',   supervisor_id: '1', completed_hours: 240, required_hours: 500 },
    { $id: 'i2', first_name: 'Jasmine', last_name: 'Bautista', school: 'TUP',  course: 'BSCS',   status: 'Active',   supervisor_id: '1', completed_hours: 380, required_hours: 500 },
    { $id: 'i3', first_name: 'Mark',    last_name: 'Ong',      school: 'DLSU', course: 'BS ECE', status: 'Inactive', supervisor_id: '1', completed_hours: 100, required_hours: 500 },
  ],
  '2': [
    { $id: 'i4', first_name: 'Carla',  last_name: 'Dizon',  school: 'UST',  course: 'BSCS',    status: 'Active',  supervisor_id: '2', completed_hours: 450, required_hours: 500 },
    { $id: 'i5', first_name: 'Nathan', last_name: 'Flores', school: 'AdMU', course: 'BS Math', status: 'Pending', supervisor_id: '2', completed_hours: 60,  required_hours: 500 },
  ],
  '4': [
    { $id: 'i6', first_name: 'Lea', last_name: 'Torres', school: 'MAPUA', course: 'BSCE', status: 'Active', supervisor_id: '4', completed_hours: 300, required_hours: 500 },
  ],
  '5': [
    { $id: 'i7', first_name: 'Gio', last_name: 'Valdez',  school: 'FEU', course: 'BSIT', status: 'Active', supervisor_id: '5', completed_hours: 200, required_hours: 500 },
    { $id: 'i8', first_name: 'Ria', last_name: 'Mercado', school: 'PUP', course: 'BSCS', status: 'Active', supervisor_id: '5', completed_hours: 490, required_hours: 500 },
  ],
  '6': [
    { $id: 'i9',  first_name: 'Paolo', last_name: 'Aguilar', school: 'DLSU',   course: 'BSIT', status: 'Active',   supervisor_id: '6', completed_hours: 150, required_hours: 500 },
    { $id: 'i10', first_name: 'Trish', last_name: 'Pascual', school: 'Ateneo', course: 'BSCS', status: 'Inactive', supervisor_id: '6', completed_hours: 320, required_hours: 500 },
  ],
  '7': [
    { $id: 'i11', first_name: 'Dan', last_name: 'Lim', school: 'TIP', course: 'BSECE', status: 'Active', supervisor_id: '7', completed_hours: 410, required_hours: 500 },
  ],
};

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

  currentPage = 1;
  pageSize    = 3;

  readonly BUCKET_ID       = '69baaf64002ceb2490df';
  readonly PROJECT_ID      = '69ba8d9c0027d10c447f';
  readonly ENDPOINT        = 'https://sgp.cloud.appwrite.io/v1';
  readonly SUPERVISORS_COL = 'supervisors';
  readonly INTERNS_COL     = 'interns';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadSupervisors();
  }

  async loadSupervisors() {
    this.loading = true;
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.SUPERVISORS_COL
      );
      this.supervisors         = res.documents.length ? res.documents as any[] : DUMMY_SUPERVISORS;
      this.filteredSupervisors = [...this.supervisors];
    } catch {
      this.supervisors         = DUMMY_SUPERVISORS;
      this.filteredSupervisors = [...this.supervisors];
    } finally {
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
    this.selectedSupervisor = sup;
    this.isEditing          = false;
    this.formError          = '';
    this.showPassword       = false;
    this.activeTab          = 'profile';
    this.assignedInterns    = [];
    this.isAccountActive    = (sup.status || 'Active') === 'Active';
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
  }

  openAddModal() {
    this.selectedSupervisor = null;
    this.isEditing          = false;
    this.editingId          = '';
    this.form               = this.emptyForm();
    this.formError          = '';
    this.showPassword       = false;
    this.assignedInterns    = [];
    this.showModal          = true;
  }

  enableEdit() { this.isEditing = true; }

  closeModal() {
    this.showModal          = false;
    this.isEditing          = false;
    this.selectedSupervisor = null;
    this.formError          = '';
    this.assignedInterns    = [];
  }

  openDeleteConfirm() {
    this.supervisorToDelete = this.selectedSupervisor;
    this.showDeleteConfirm  = true;
  }

  async switchToStudentsTab() {
    this.activeTab = 'students';
    if (this.assignedInterns.length === 0) {
      await this.loadAssignedInterns();
    }
  }

  async loadAssignedInterns() {
    if (!this.selectedSupervisor) return;
    this.internsLoading = true;
    try {
      const { Query } = await import('appwrite');
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.INTERNS_COL,
        [Query.equal('supervisor_id', this.selectedSupervisor.$id)]
      );
      this.assignedInterns = res.documents as any[];
    } catch {
      this.assignedInterns = DUMMY_INTERNS[this.selectedSupervisor.$id] ?? [];
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
    if (!this.selectedSupervisor && !this.form.password.trim()) {
      this.formError = 'Password is required when creating a new account.'; return;
    }
    this.submitting = true;
    try {
      const payload: any = {
        first_name  : this.form.first_name.trim(),
        last_name   : this.form.last_name.trim(),
        employee_id : this.form.employee_id.trim(),
        email       : this.form.email.trim(),
        grade_level : this.form.grade_level,
        status      : 'Active',
      };
      if (this.selectedSupervisor) {
        payload.status = this.selectedSupervisor.status || 'Active';
        await this.appwrite.databases.updateDocument(
          this.appwrite.DATABASE_ID, this.SUPERVISORS_COL, this.editingId, payload);
      } else {
        const account = await this.appwrite.account.create(
          ID.unique(), this.form.email.trim(), this.form.password,
          `${this.form.first_name} ${this.form.last_name}`);
        await this.appwrite.databases.createDocument(
          this.appwrite.DATABASE_ID, this.SUPERVISORS_COL, account.$id,
          { ...payload, assigned_students: 0 });
      }
      await this.loadSupervisors();
      this.closeModal();
    } catch (err: any) {
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

  onToggleSidebar(c: boolean) { this.isCollapsed = c; }

  getFullName(s: Supervisor)   { return `${s.first_name} ${s.last_name}`; }
  getInternFullName(i: Intern) { return `${i.first_name} ${i.last_name}`; }

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
}