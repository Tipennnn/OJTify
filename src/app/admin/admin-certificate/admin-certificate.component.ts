import { Component, OnInit, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import Swal from 'sweetalert2';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Intern {
  $id:            string;
  name:           string;
  studentId:      string;
  course:         string;
  school:         string;
  hoursCompleted: number;
  startDate:      string;
  endDate:        string;
  photoUrl?:      string;
  sentDate?:      string;
  _sortDate?:     number;
  /** raw ISO date string used for date filtering */
  _rawStartDate?: string;
  _rawEndDate?:   string;
  _rawSentDate?:  string;
}

export interface CertTemplate {
  requiredHours:     number;
  republic:          string;
  department:        string;
  division:          string;
  schoolName:        string;
  hostSchool:        string;
  address:           string;
  mainTitle:         string;
  subtitleTag:       string;
  awardedText:       string;
  bodyText:          string;
  givenText:         string;
  supervisorName:    string;
  supervisorPos:     string;
  leftSignatoryName: string;
  leftSignatoryPos:  string;
  issuedLocation:    string;
  primaryColor:      string;
  accentColor:       string;
  depedLogoUrl:      string;
  schoolLogoUrl:     string;
  watermarkUrl:      string;
  leftSigUrl:        string;
  rightSigUrl:       string;
}

// ─── Default Template ─────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE: CertTemplate = {
  requiredHours:     500,
  republic:          'Republic of the Philippines',
  department:        'Department of Education',
  division:          'Schools Division of Olongapo City',
  schoolName:        'Olongapo City Elementary School',
  hostSchool:        'Olongapo City Elementary School',
  address:           'Olongapo City, Zambales',
  mainTitle:         'Certificate of Completion',
  subtitleTag:       'On-the-Job Training Program',
  awardedText:       'This certificate is proudly awarded to',
  bodyText:          'for successfully completing the <strong>{hours}-hour On-the-Job Training (OJT)</strong>, taking up <strong>{course}</strong> from <strong>{school}</strong>, conducted at <strong>{host}</strong>.',
  givenText:         'Given this {date}, {location}.',
  supervisorName:    'Maria Santos',
  supervisorPos:     'OJT Supervisor',
  leftSignatoryName: 'Juan Dela Cruz',
  leftSignatoryPos:  'School Principal',
  issuedLocation:    'Olongapo City, Zambales',
  primaryColor:      '#1e3a8a',
  accentColor:       '#c9a84c',
  depedLogoUrl:      'assets/images/Deped_logo.png',
  schoolLogoUrl:     'assets/images/OCES_logo.png',
  watermarkUrl:      'assets/images/OCES_logo.png',
  leftSigUrl:        '',
  rightSigUrl:       '',
};

// ─── Sort option descriptor ───────────────────────────────────────────────────

export interface SortOption {
  key:   string;
  label: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-admin-certificate',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidenavComponent, AdminTopnavComponent, DecimalPipe],
  templateUrl: './admin-certificate.component.html',
  styleUrls: ['./admin-certificate.component.css']
})
export class AdminCertificateComponent implements OnInit {

  // ── Layout
  sidenavCollapsed = false;

  // ── UI State
  activeTab: 'completed' | 'ongoing' | 'sent' = 'completed';
  showSettings    = false;
  showCertPreview = false;
  showSendModal   = false;
  searchQuery     = '';

  // ── Sort
  sortKey  = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  showSortPanel = false;

  // ── Filter
  showFilterPanel = false;
  filterYear:     number | null = null;
  filterMonth:    number | null = null;   // 1–12
  filterHoursMin: number | null = null;
  filterHoursMax: number | null = null;
  // applied (committed) values
  appliedYear:     number | null = null;
  appliedMonth:    number | null = null;
  appliedHoursMin: number | null = null;
  appliedHoursMax: number | null = null;

  readonly monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  /** Collect unique years from all interns' start/end dates + sentDates */
  get availableYears(): number[] {
    const years = new Set<number>();
    const addDate = (raw?: string) => {
      if (!raw) return;
      const d = new Date(raw);
      if (!isNaN(d.getTime())) years.add(d.getFullYear());
    };
    this.allInterns.forEach(i => {
      addDate(i._rawStartDate);
      addDate(i._rawEndDate);
    });
    this.sentCerts.forEach(i => {
      addDate(i._rawStartDate);
      addDate(i._rawEndDate);
      addDate(i._rawSentDate);
    });
    // also current year
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }

  get hasActiveFilters(): boolean {
    return !!(this.appliedYear || this.appliedHoursMin !== null || this.appliedHoursMax !== null);
  }

  get activeFilterCount(): number {
    let n = 0;
    if (this.appliedYear)                  n++;
    if (this.appliedMonth)                 n++;
    if (this.appliedHoursMin !== null)     n++;
    if (this.appliedHoursMax !== null)     n++;
    return n;
  }

  toggleFilterPanel(event: MouseEvent): void {
    event.stopPropagation();
    // sync draft values from applied
    this.filterYear     = this.appliedYear;
    this.filterMonth    = this.appliedMonth;
    this.filterHoursMin = this.appliedHoursMin;
    this.filterHoursMax = this.appliedHoursMax;
    this.showFilterPanel = !this.showFilterPanel;
    this.showSortPanel = false;
  }

  toggleYearFilter(year: number): void {
    this.filterYear  = this.filterYear === year ? null : year;
    this.filterMonth = null; // reset month when year changes
  }

  toggleMonthFilter(month: number): void {
    this.filterMonth = this.filterMonth === month ? null : month;
  }

  applyFilters(): void {
    this.appliedYear     = this.filterYear;
    this.appliedMonth    = this.filterMonth;
    this.appliedHoursMin = this.filterHoursMin !== null && this.filterHoursMin !== undefined && String(this.filterHoursMin) !== '' ? Number(this.filterHoursMin) : null;
    this.appliedHoursMax = this.filterHoursMax !== null && this.filterHoursMax !== undefined && String(this.filterHoursMax) !== '' ? Number(this.filterHoursMax) : null;
    this.currentPage     = 1;
    this.showFilterPanel = false;
  }

  clearAllFilters(): void {
    this.filterYear      = null;
    this.filterMonth     = null;
    this.filterHoursMin  = null;
    this.filterHoursMax  = null;
    this.appliedYear     = null;
    this.appliedMonth    = null;
    this.appliedHoursMin = null;
    this.appliedHoursMax = null;
    this.currentPage     = 1;
    this.showFilterPanel = false;
  }

  /**
   * Determine which raw date to use for filtering based on tab.
   * - completed / ongoing: use startDate
   * - sent: use sentDate (or startDate fallback)
   */
  private getFilterDate(intern: Intern): Date | null {
    let raw: string | undefined;
    if (this.activeTab === 'sent') {
      raw = intern._rawSentDate || intern._rawStartDate;
    } else {
      raw = intern._rawStartDate;
    }
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  private passesFilters(intern: Intern): boolean {
    // Hours filter
    if (this.appliedHoursMin !== null && intern.hoursCompleted < this.appliedHoursMin) return false;
    if (this.appliedHoursMax !== null && intern.hoursCompleted > this.appliedHoursMax) return false;
    // Date filter
    if (this.appliedYear !== null) {
      const d = this.getFilterDate(intern);
      if (!d) return false;
      if (d.getFullYear() !== this.appliedYear) return false;
      if (this.appliedMonth !== null && d.getMonth() + 1 !== this.appliedMonth) return false;
    }
    return true;
  }

  /** Sort options */
  get sortOptions(): SortOption[] {
    const common: SortOption[] = [
      { key: 'name',      label: 'Name'       },
      { key: 'studentId', label: 'Student ID'  },
      { key: 'course',    label: 'Course'      },
      { key: 'startDate', label: 'Start Date'  },
      { key: 'hours',     label: 'Hours'       },
    ];
    if (this.activeTab === 'sent') {
      return [...common, { key: 'sentDate', label: 'Sent Date' }];
    }
    return common;
  }

  // ── 3-dot dropdown
  openDotMenu: string | null = null;

  // ── Pagination
  currentPage = 1;
  pageSize    = 10;

  // ── Data
  allInterns:       Intern[] = [];
  completedInterns: Intern[] = [];
  ongoingInterns:   Intern[] = [];
  sentCerts:        Intern[] = [];

  selectedIntern: Intern | null = null;
  sendTarget:     Intern | null = null;

  certTemplate: CertTemplate = { ...DEFAULT_TEMPLATE };

  // ── Appwrite
  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  // ──────────────────────────────────────────────────────────────────────────
  //  PAN + ZOOM — Mini preview (settings modal)
  // ──────────────────────────────────────────────────────────────────────────

  miniScale   = 1;
  miniTransX  = 0;
  miniTransY  = 0;
  miniDragging = false;
  miniDragStartX = 0;
  miniDragStartY = 0;
  miniDragOriginX = 0;
  miniDragOriginY = 0;

  get miniTransformStyle(): string {
    return `translate(${this.miniTransX}px, ${this.miniTransY}px) scale(${this.miniScale})`;
  }

  miniZoomIn():    void { this.miniScale = Math.min(3, this.miniScale + 0.25); }
  miniZoomOut():   void { this.miniScale = Math.max(0.5, this.miniScale - 0.25); }
  miniZoomReset(): void { this.miniScale = 1; this.miniTransX = 0; this.miniTransY = 0; }

  miniStartDrag(e: MouseEvent): void {
    this.miniDragging   = true;
    this.miniDragStartX = e.clientX;
    this.miniDragStartY = e.clientY;
    this.miniDragOriginX = this.miniTransX;
    this.miniDragOriginY = this.miniTransY;
    e.preventDefault();
  }

  miniOnDrag(e: MouseEvent): void {
    if (!this.miniDragging) return;
    this.miniTransX = this.miniDragOriginX + (e.clientX - this.miniDragStartX);
    this.miniTransY = this.miniDragOriginY + (e.clientY - this.miniDragStartY);
  }

  miniStopDrag(): void { this.miniDragging = false; }

  miniOnWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.miniScale = Math.min(3, Math.max(0.5, this.miniScale + delta));
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  PAN + ZOOM — Full cert preview modal
  // ──────────────────────────────────────────────────────────────────────────

  certScale   = 0.75;
  certTransX  = 0;
  certTransY  = 0;
  certDragging = false;
  certDragStartX = 0;
  certDragStartY = 0;
  certDragOriginX = 0;
  certDragOriginY = 0;

  get certTransformStyle(): string {
    return `translate(${this.certTransX}px, ${this.certTransY}px) scale(${this.certScale})`;
  }

  certZoomIn():  void { this.certScale = Math.min(2, this.certScale + 0.1); }
  certZoomOut(): void { this.certScale = Math.max(0.25, this.certScale - 0.1); }
  certResetView(): void { this.certScale = 0.75; this.certTransX = 0; this.certTransY = 0; }

  certStartDrag(e: MouseEvent): void {
    this.certDragging   = true;
    this.certDragStartX = e.clientX;
    this.certDragStartY = e.clientY;
    this.certDragOriginX = this.certTransX;
    this.certDragOriginY = this.certTransY;
    e.preventDefault();
  }

  certOnDrag(e: MouseEvent): void {
    if (!this.certDragging) return;
    this.certTransX = this.certDragOriginX + (e.clientX - this.certDragStartX);
    this.certTransY = this.certDragOriginY + (e.clientY - this.certDragStartY);
  }

  certStopDrag(): void { this.certDragging = false; }

  certOnWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    this.certScale = Math.min(2, Math.max(0.25, this.certScale + delta));
  }

  // ──────────────────────────────────────────────────────────────────────────

  constructor(private appwrite: AppwriteService) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async ngOnInit() {
    this.loadSavedTemplate();
    this.loadSentCertsFromStorage();
    await this.loadInterns();
  }

  // ── Sidenav ───────────────────────────────────────────────────────────────────

  onSidenavToggle(collapsed: boolean) {
    this.sidenavCollapsed = collapsed;
  }

  // ── Tab ───────────────────────────────────────────────────────────────────────

  switchTab(tab: 'completed' | 'ongoing' | 'sent') {
    this.activeTab    = tab;
    this.currentPage  = 1;
    this.sortKey      = 'name';
    this.sortDir      = 'asc';
    this.showSortPanel = false;
    this.showFilterPanel = false;
  }

  // ── Sort panel ────────────────────────────────────────────────────────────────

  toggleSortPanel(event: MouseEvent): void {
    event.stopPropagation();
    this.showSortPanel = !this.showSortPanel;
    this.showFilterPanel = false;
  }

  setSort(key: string, dir: 'asc' | 'desc'): void {
    this.sortKey      = key;
    this.sortDir      = dir;
    this.currentPage  = 1;
    this.showSortPanel = false;
  }

  /** Sort a list by the current sortKey / sortDir */
  private applySort(list: Intern[]): Intern[] {
    return [...list].sort((a, b) => {
      let av: any;
      let bv: any;
      switch (this.sortKey) {
        case 'name':      av = a.name.toLowerCase();      bv = b.name.toLowerCase();      break;
        case 'studentId': av = a.studentId.toLowerCase(); bv = b.studentId.toLowerCase(); break;
        case 'course':    av = a.course.toLowerCase();    bv = b.course.toLowerCase();    break;
        case 'startDate': av = a._sortDate ?? 0;          bv = b._sortDate ?? 0;          break;
        case 'hours':     av = a.hoursCompleted;          bv = b.hoursCompleted;          break;
        case 'sentDate':
          av = a._rawSentDate ? new Date(a._rawSentDate).getTime() : 0;
          bv = b._rawSentDate ? new Date(b._rawSentDate).getTime() : 0;
          break;
        default:          av = a.name.toLowerCase();      bv = b.name.toLowerCase();
      }
      if (av < bv) return this.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return this.sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  // ── Template ──────────────────────────────────────────────────────────────────

  loadSavedTemplate(): void {
    const saved = localStorage.getItem('admin_cert_template');
    if (saved) {
      try { this.certTemplate = { ...DEFAULT_TEMPLATE, ...JSON.parse(saved) }; }
      catch { this.certTemplate = { ...DEFAULT_TEMPLATE }; }
    }
  }

  saveTemplate(): void {
    localStorage.setItem('admin_cert_template', JSON.stringify(this.certTemplate));
    this.closeSettings();
    this.splitInterns();
    Swal.fire({ icon: 'success', title: 'Template Saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, timerProgressBar: true });
  }

  resetTemplate(): void {
    Swal.fire({
      icon: 'warning', title: 'Reset Template?',
      text: 'Restore all fields to their default values?',
      showCancelButton: true, confirmButtonColor: '#2563eb',
      cancelButtonColor: '#9ca3af', confirmButtonText: 'Yes, reset'
    }).then(r => {
      if (r.isConfirmed) {
        this.certTemplate = { ...DEFAULT_TEMPLATE };
        localStorage.removeItem('admin_cert_template');
      }
    });
  }

  openTemplateSettings(): void {
    this.miniZoomReset();
    this.showSettings = true;
  }
  closeSettings(): void { this.showSettings = false; }

  // ── Data ──────────────────────────────────────────────────────────────────────

  async loadInterns(): Promise<void> {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      this.allInterns = (res.documents as any[]).map(doc => ({
        $id:            doc.$id,
        name:           doc.name ?? doc.full_name ?? 'Unknown Intern',
        studentId:      doc.student_id ?? '',
        course:         doc.course ?? 'N/A',
        school:         doc.school ?? 'N/A',
        hoursCompleted: doc.hours_rendered ?? doc.hoursCompleted ?? doc.completed_hours ?? 0,
        startDate:      this.formatDate(doc.start_date ?? doc.startDate ?? doc.$createdAt),
        endDate:        this.formatDate(doc.end_date ?? doc.endDate),
        photoUrl:       doc.profile_photo_id
                          ? `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${doc.profile_photo_id}/view?project=${this.PROJECT_ID}`
                          : '',
        _sortDate:      new Date(doc.end_date ?? doc.endDate ?? doc.$createdAt ?? 0).getTime(),
        _rawStartDate:  doc.start_date ?? doc.startDate ?? doc.$createdAt ?? '',
        _rawEndDate:    doc.end_date ?? doc.endDate ?? '',
      }));
      this.splitInterns();
    } catch (err) {
      console.error('Failed to load interns:', err);
      this.loadMockData();
    }
  }

  private splitInterns(): void {
    const sentIds = new Set(this.sentCerts.map(s => s.$id));
    this.completedInterns = this.allInterns
      .filter(i => i.hoursCompleted >= this.certTemplate.requiredHours && !sentIds.has(i.$id))
      .sort((a, b) => (b._sortDate ?? 0) - (a._sortDate ?? 0));
    this.ongoingInterns = this.allInterns
      .filter(i => i.hoursCompleted < this.certTemplate.requiredHours && !sentIds.has(i.$id))
      .sort((a, b) => b.hoursCompleted - a.hoursCompleted);
    this.currentPage = 1;
  }

  private loadMockData(): void {
    this.allInterns = [
      { $id: '1', name: 'Maria Clara Santos',    studentId: 'STU-001', course: 'BSIT', school: 'PUP',            hoursCompleted: 500, startDate: 'January 6, 2025',  endDate: 'May 16, 2025',  photoUrl: '', _sortDate: new Date('2025-05-16').getTime(), _rawStartDate: '2025-01-06', _rawEndDate: '2025-05-16' },
      { $id: '2', name: 'Juan Pablo Reyes',       studentId: 'STU-002', course: 'BSCS', school: 'Gordon College', hoursCompleted: 500, startDate: 'January 6, 2025',  endDate: 'May 10, 2025',  photoUrl: '', _sortDate: new Date('2025-05-10').getTime(), _rawStartDate: '2025-01-06', _rawEndDate: '2025-05-10' },
      { $id: '3', name: 'Angela Marie Cruz',      studentId: 'STU-003', course: 'BSED', school: 'Holy Angels',    hoursCompleted: 320, startDate: 'February 3, 2025', endDate: '',              photoUrl: '', _sortDate: 0, _rawStartDate: '2025-02-03', _rawEndDate: '' },
      { $id: '4', name: 'Ricardo Jose Flores',    studentId: 'STU-004', course: 'BSIT', school: 'DMMMSU',         hoursCompleted: 410, startDate: 'February 3, 2025', endDate: '',              photoUrl: '', _sortDate: 0, _rawStartDate: '2025-02-03', _rawEndDate: '' },
      { $id: '5', name: 'Sophia Nicole Bautista', studentId: 'STU-005', course: 'BSBA', school: 'Columban',       hoursCompleted: 180, startDate: 'March 3, 2025',    endDate: '',              photoUrl: '', _sortDate: 0, _rawStartDate: '2025-03-03', _rawEndDate: '' },
    ];
    this.splitInterns();
  }

  // ── Sent certs persistence ────────────────────────────────────────────────────

  private loadSentCertsFromStorage(): void {
    const saved = localStorage.getItem('admin_sent_certs');
    if (saved) {
      try { this.sentCerts = JSON.parse(saved); }
      catch { this.sentCerts = []; }
    }
    this.sentCerts.sort((a, b) => {
      const da = a._rawSentDate ? new Date(a._rawSentDate).getTime() : 0;
      const db = b._rawSentDate ? new Date(b._rawSentDate).getTime() : 0;
      return db - da;
    });
  }

  private saveSentCertsToStorage(): void {
    localStorage.setItem('admin_sent_certs', JSON.stringify(this.sentCerts));
  }

  // ── Filtered + sorted lists ───────────────────────────────────────────────────

  private filterList(list: Intern[]): Intern[] {
    let result = list;
    // text search
    const q = this.searchQuery.toLowerCase();
    if (q) {
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.studentId || '').toLowerCase().includes(q) ||
        i.course.toLowerCase().includes(q)
      );
    }
    // date + hours filters
    result = result.filter(i => this.passesFilters(i));
    return result;
  }

  get filteredCompleted(): Intern[] { return this.applySort(this.filterList(this.completedInterns)); }
  get filteredOngoing():   Intern[] { return this.applySort(this.filterList(this.ongoingInterns)); }
  get filteredSent():      Intern[] { return this.applySort(this.filterList(this.sentCerts)); }

  get activeList(): Intern[] {
    if (this.activeTab === 'completed') return this.filteredCompleted;
    if (this.activeTab === 'ongoing')   return this.filteredOngoing;
    return this.filteredSent;
  }

  // ── Pagination ────────────────────────────────────────────────────────────────

  get totalPages():     number { return Math.max(1, Math.ceil(this.activeList.length / this.pageSize)); }
  get pageRangeStart(): number { return this.activeList.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1; }
  get pageRangeEnd():   number { return Math.min(this.currentPage * this.pageSize, this.activeList.length); }

  prevPage(): void { if (this.currentPage > 1) this.currentPage--; }
  nextPage(): void { if (this.currentPage < this.totalPages) this.currentPage++; }
  goToPage(p: number): void { if (p >= 1 && p <= this.totalPages) this.currentPage = p; }

  get visiblePageNumbers(): number[] {
    const total = this.totalPages;
    const cur   = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [];
    const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
    add(1);
    if (cur - 2 > 2)  pages.push(-1);
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) add(i);
    if (cur + 2 < total - 1) pages.push(-1);
    add(total);
    return pages;
  }

  get pagedCompleted(): Intern[] { return this.paginate(this.filteredCompleted); }
  get pagedOngoing():   Intern[] { return this.paginate(this.filteredOngoing); }
  get pagedSent():      Intern[] { return this.paginate(this.filteredSent); }

  private paginate(list: Intern[]): Intern[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  getPct(hours: number): number {
    return Math.min(100, Math.round((hours / this.certTemplate.requiredHours) * 100));
  }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  getBodyText(intern: Intern): string {
    return (this.certTemplate.bodyText || '')
      .replace(/{name}/g,   intern.name)
      .replace(/{hours}/g,  String(intern.hoursCompleted))
      .replace(/{course}/g, intern.course)
      .replace(/{school}/g, intern.school)
      .replace(/{host}/g,   this.certTemplate.hostSchool);
  }

  getGivenText(intern: Intern): string {
    const date = intern.endDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return (this.certTemplate.givenText || '')
      .replace(/{date}/g,     date)
      .replace(/{location}/g, this.certTemplate.issuedLocation);
  }

  private formatDate(raw: string | null | undefined): string {
    if (!raw) return '';
    try { return new Date(raw).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return raw; }
  }

  // ── 3-dot dropdown ────────────────────────────────────────────────────────────

  toggleDotMenu(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.openDotMenu = this.openDotMenu === id ? null : id;
  }

  closeDotMenu(): void { this.openDotMenu = null; }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openDotMenu    = null;
    this.showSortPanel  = false;
    this.showFilterPanel = false;
  }

  // ── Preview ───────────────────────────────────────────────────────────────────

  previewCert(intern: Intern): void {
    this.certResetView();
    this.selectedIntern  = intern;
    this.showCertPreview = true;
  }

  closeCertPreview(): void {
    this.showCertPreview = false;
    this.selectedIntern  = null;
  }

  // ── Send Certificate ──────────────────────────────────────────────────────────

  promptSendCert(intern: Intern): void {
    this.sendTarget    = intern;
    this.showSendModal = true;
  }

  closeSendModal(): void {
    this.showSendModal = false;
    this.sendTarget    = null;
  }

  confirmSendCert(): void {
    if (!this.sendTarget) return;
    const intern  = this.sendTarget;
    const today   = new Date();
    const todayFmt = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    this.sentCerts.unshift({
      ...intern,
      sentDate:      todayFmt,
      _rawSentDate:  today.toISOString(),
    });
    this.saveSentCertsToStorage();
    this.completedInterns = this.completedInterns.filter(i => i.$id !== intern.$id);
    this.closeSendModal();
    Swal.fire({
      icon: 'success', title: 'Certificate Sent!',
      html: `Certificate has been issued to <b>${intern.name}</b>.`,
      toast: true, position: 'top-end', showConfirmButton: false,
      timer: 3000, timerProgressBar: true,
    });
    this.downloadCert(intern);
  }

  // ── Download / Print ──────────────────────────────────────────────────────────

  downloadCert(intern: Intern | null): void {
    if (!intern) return;

    const wasOpen       = this.showCertPreview;
    this.certResetView();
    this.selectedIntern = intern;
    this.showCertPreview = true;

    setTimeout(() => {
      const certEl = document.getElementById('certificate-preview');
      if (!certEl) { if (!wasOpen) this.showCertPreview = false; return; }

      const styles = Array.from(document.styleSheets).map(sheet => {
        try   { return Array.from(sheet.cssRules).map(r => r.cssText).join('\n'); }
        catch { return sheet.href ? `@import url('${sheet.href}');` : ''; }
      }).join('\n');

      const printWin = window.open('', '_blank', 'width=1,height=1,left=-9999,top=-9999');
      if (!printWin) {
        Swal.fire({ icon: 'warning', title: 'Pop-up Blocked', text: 'Please allow pop-ups to download the certificate.', confirmButtonColor: '#2563eb' });
        return;
      }

      printWin.document.write(`
        <!DOCTYPE html><html>
          <head>
            <title>Certificate_${intern.name.replace(/\s+/g, '_')}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap">
            <style>
              ${styles}
              * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
              @page { size:A4 landscape; margin:0; }
              @media print { body { margin:0; background:white; } .certificate { box-shadow:none!important; } }
              body { margin:0; padding:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:white; }
              .certificate { width:100%; max-width:100%; transform:none!important; }
            </style>
          </head>
          <body>
            ${certEl.outerHTML}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() { window.close(); };
                  setTimeout(function() { window.close(); }, 3000);
                }, 600);
              };
            <\/script>
          </body>
        </html>
      `);
      printWin.document.close();
      if (!wasOpen) setTimeout(() => { this.showCertPreview = false; }, 1000);
    }, 150);
  }

  // ── Logo Uploads ──────────────────────────────────────────────────────────────

  onLogoChange(event: Event, type: 'deped' | 'school' | 'watermark' | 'leftSig' | 'rightSig'): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.readFile(file, type);
  }

  onLogoDrop(event: DragEvent, type: 'deped' | 'school' | 'watermark' | 'leftSig' | 'rightSig'): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) this.readFile(file, type);
  }

  private readFile(file: File, type: 'deped' | 'school' | 'watermark' | 'leftSig' | 'rightSig'): void {
    const reader = new FileReader();
    reader.onload = e => {
      const url = e.target?.result as string;
      if (type === 'deped')     this.certTemplate.depedLogoUrl  = url;
      if (type === 'school')    this.certTemplate.schoolLogoUrl = url;
      if (type === 'watermark') this.certTemplate.watermarkUrl  = url;
      if (type === 'leftSig')   this.certTemplate.leftSigUrl    = url;
      if (type === 'rightSig')  this.certTemplate.rightSigUrl   = url;
    };
    reader.readAsDataURL(file);
  }
}