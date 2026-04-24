import { Component, OnInit, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { ID, Query } from 'appwrite';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Intern {
  $id:              string;
  name:             string;
  studentId:        string;
  course:           string;
  school:           string;
  hoursCompleted:   number;
  requiredHours:    number;
  startDate:        string;
  endDate:          string;
  photoUrl?:        string;
  sentDate?:        string;
  _sortDate?:       number;
  _rawStartDate?:   string;
  _rawEndDate?:     string;
  _rawSentDate?:    string;
  // ── NEW: per-intern supervisor info ──
  supervisorName:   string;
  supervisorPos:    string;
  rightSigBase64:   string;
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
  bodyText:          'for successfully completing the {hours}-hour On-the-Job Training (OJT), taking up {course} from {school}, conducted at {host}.',
  givenText:         'Given this {date}, at {location}.',
  supervisorName:    'Maria Santos',
  supervisorPos:     'OJT Supervisor',
  leftSignatoryName: 'Juan Dela Cruz',
  leftSignatoryPos:  'School Principal',
  issuedLocation:    'Olongapo City Elementary School',
  primaryColor:      '#1e3a8a',
  accentColor:       '#c9a84c',
  depedLogoUrl:      '',
  schoolLogoUrl:     '',
  watermarkUrl:      '',
  leftSigUrl:        '',
  rightSigUrl:       '',
};

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
  filterMonth:    number | null = null;
  filterHoursMin: number | null = null;
  filterHoursMax: number | null = null;
  appliedYear:     number | null = null;
  appliedMonth:    number | null = null;
  appliedHoursMin: number | null = null;
  appliedHoursMax: number | null = null;

  readonly monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── Reduced, more sensible character limits ────────────────────────────────
  readonly FIELD_LIMITS = {
    republic:          50,   // "Republic of the Philippines" = 28 chars — 50 is generous
    department:        55,   // "Department of Education" = 23 chars
    division:          50,   // e.g. "Schools Division of Olongapo City" = 34 chars
    schoolName:        40,   // school names rarely exceed 40 chars
    hostSchool:        40,
    address:           60,   // full address incl. city/province
    mainTitle:         30,   // "Certificate of Completion" = 25 chars
    subtitleTag:       40,   // "On-the-Job Training Program" = 28 chars
    awardedText:       50,   // short preamble line
    bodyText:          220,  // main body paragraph
    givenText:         80,   // "Given this {date}, at {location}."
    leftSignatoryName: 35,   // full name
    leftSignatoryPos:  35,   // position/title
    supervisorName:    35,
    supervisorPos:     35,
    issuedLocation:    40,
  };


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
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }

  get hasActiveFilters(): boolean {
    return !!(this.appliedYear || this.appliedHoursMin !== null || this.appliedHoursMax !== null);
  }

  get activeFilterCount(): number {
    let n = 0;
    if (this.appliedYear)              n++;
    if (this.appliedMonth)             n++;
    if (this.appliedHoursMin !== null) n++;
    if (this.appliedHoursMax !== null) n++;
    return n;
  }

  toggleFilterPanel(event: MouseEvent): void {
    event.stopPropagation();
    this.filterYear     = this.appliedYear;
    this.filterMonth    = this.appliedMonth;
    this.filterHoursMin = this.appliedHoursMin;
    this.filterHoursMax = this.appliedHoursMax;
    this.showFilterPanel = !this.showFilterPanel;
    this.showSortPanel = false;
  }

  toggleYearFilter(year: number): void {
    this.filterYear  = this.filterYear === year ? null : year;
    this.filterMonth = null;
  }

  toggleMonthFilter(month: number): void {
    this.filterMonth = this.filterMonth === month ? null : month;
  }

  applyFilters(): void {
    this.appliedYear     = this.filterYear;
    this.appliedMonth    = this.filterMonth;
    this.appliedHoursMin = this.filterHoursMin !== null && String(this.filterHoursMin) !== '' ? Number(this.filterHoursMin) : null;
    this.appliedHoursMax = this.filterHoursMax !== null && String(this.filterHoursMax) !== '' ? Number(this.filterHoursMax) : null;
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
    if (this.appliedHoursMin !== null && intern.hoursCompleted < this.appliedHoursMin) return false;
    if (this.appliedHoursMax !== null && intern.hoursCompleted > this.appliedHoursMax) return false;
    if (this.appliedYear !== null) {
      const d = this.getFilterDate(intern);
      if (!d) return false;
      if (d.getFullYear() !== this.appliedYear) return false;
      if (this.appliedMonth !== null && d.getMonth() + 1 !== this.appliedMonth) return false;
    }
    return true;
  }

  get sortOptions(): SortOption[] {
    const common: SortOption[] = [
      { key: 'name',      label: 'Name'      },
      { key: 'studentId', label: 'Student ID' },
      { key: 'course',    label: 'Course'     },
      { key: 'startDate', label: 'Start Date' },
      { key: 'hours',     label: 'Hours'      },
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
  readonly BUCKET_ID        = '69baaf64002ceb2490df';
  readonly OJT_FILES_BUCKET = '69baaf64002ceb2490df';
  readonly PROJECT_ID       = '69ba8d9c0027d10c447f';
  readonly ENDPOINT         = 'https://sgp.cloud.appwrite.io/v1';
  readonly CERT_TEMPLATE_DOC_KEY = 'cert_template_json';

  private fileIdMap: Record<string, string> = {};

  // ── Pan + Zoom (mini preview)
  miniScale    = 1;
  miniTransX   = 0;
  miniTransY   = 0;
  miniDragging = false;
  miniDragStartX  = 0;
  miniDragStartY  = 0;
  miniDragOriginX = 0;
  miniDragOriginY = 0;

  get miniTransformStyle(): string {
    return `translate(${this.miniTransX}px, ${this.miniTransY}px) scale(${this.miniScale})`;
  }

  miniZoomIn():    void { this.miniScale = Math.min(3, this.miniScale + 0.25); }
  miniZoomOut():   void { this.miniScale = Math.max(0.5, this.miniScale - 0.25); }
  miniZoomReset(): void { this.miniScale = 1; this.miniTransX = 0; this.miniTransY = 0; }

  miniStartDrag(e: MouseEvent): void {
    this.miniDragging    = true;
    this.miniDragStartX  = e.clientX;
    this.miniDragStartY  = e.clientY;
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

  // ── Pan + Zoom (full cert preview)
  certScale    = 0.75;
  certTransX   = 0;
  certTransY   = 0;
  certDragging = false;
  certDragStartX  = 0;
  certDragStartY  = 0;
  certDragOriginX = 0;
  certDragOriginY = 0;

  get certTransformStyle(): string {
    return `translate(${this.certTransX}px, ${this.certTransY}px) scale(${this.certScale})`;
  }

  certZoomIn():    void { this.certScale = Math.min(2, this.certScale + 0.1); }
  certZoomOut():   void { this.certScale = Math.max(0.25, this.certScale - 0.1); }
  certResetView(): void { this.certScale = 0.75; this.certTransX = 0; this.certTransY = 0; }

  certStartDrag(e: MouseEvent): void {
    this.certDragging    = true;
    this.certDragStartX  = e.clientX;
    this.certDragStartY  = e.clientY;
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

  // ─────────────────────────────────────────────────────────────────────────────

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadSavedTemplate();
    this.loadSavedFileIds();
    await this.loadInterns();
  }

  onSidenavToggle(collapsed: boolean) {
    this.sidenavCollapsed = collapsed;
  }

  // ── Tab ───────────────────────────────────────────────────────────────────────

  switchTab(tab: 'completed' | 'ongoing' | 'sent') {
    this.activeTab       = tab;
    this.currentPage     = 1;
    this.sortKey         = 'name';
    this.sortDir         = 'asc';
    this.showSortPanel   = false;
    this.showFilterPanel = false;
  }

  // ── Sort panel ────────────────────────────────────────────────────────────────

  toggleSortPanel(event: MouseEvent): void {
    event.stopPropagation();
    this.showSortPanel   = !this.showSortPanel;
    this.showFilterPanel = false;
  }

  setSort(key: string, dir: 'asc' | 'desc'): void {
    this.sortKey      = key;
    this.sortDir      = dir;
    this.currentPage  = 1;
    this.showSortPanel = false;
  }

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

  async loadSavedTemplate(): Promise<void> {
    try {
      const user = await this.appwrite.account.get();

      let adminDoc: any = null;
      try {
        const res = await this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.ADMINS_COL,
          [Query.equal('auth_user_id', user.$id)]
        );
        if (res.documents.length > 0) adminDoc = res.documents[0];
      } catch { /* ignore */ }

      if (!adminDoc) {
        try {
          adminDoc = await this.appwrite.databases.getDocument(
            this.appwrite.DATABASE_ID,
            this.appwrite.ADMINS_COL,
            user.$id
          );
        } catch { /* ignore */ }
      }

      if (adminDoc?.cert_template_json) {
        const parsed = JSON.parse(adminDoc.cert_template_json);

        const depedFileId     = adminDoc.cert_deped_logo_url  || '';
        const schoolFileId    = adminDoc.cert_school_logo_url || '';
        const watermarkFileId = adminDoc.cert_watermark_url   || '';
        const leftSigFileId   = adminDoc.cert_left_sig_url    || '';
        const rightSigFileId  = adminDoc.cert_right_sig_url   || '';

        if (depedFileId)     this.fileIdMap['deped']     = depedFileId;
        if (schoolFileId)    this.fileIdMap['school']    = schoolFileId;
        if (watermarkFileId) this.fileIdMap['watermark'] = watermarkFileId;
        if (leftSigFileId)   this.fileIdMap['leftSig']   = leftSigFileId;
        if (rightSigFileId)  this.fileIdMap['rightSig']  = rightSigFileId;
        this.saveFileIds();

        const [depedB64, schoolB64, watermarkB64, leftSigB64, rightSigB64] = await Promise.all([
          this.appwriteFileToBase64(this.OJT_FILES_BUCKET, depedFileId),
          this.appwriteFileToBase64(this.OJT_FILES_BUCKET, schoolFileId),
          this.appwriteFileToBase64(this.OJT_FILES_BUCKET, watermarkFileId),
          this.appwriteFileToBase64(this.OJT_FILES_BUCKET, leftSigFileId),
          this.appwriteFileToBase64(this.OJT_FILES_BUCKET, rightSigFileId),
        ]);

        parsed.depedLogoUrl  = depedB64;
        parsed.schoolLogoUrl = schoolB64;
        parsed.watermarkUrl  = watermarkB64;
        parsed.leftSigUrl    = leftSigB64;
        parsed.rightSigUrl   = rightSigB64;

        this.certTemplate = { ...DEFAULT_TEMPLATE, ...parsed };
        localStorage.setItem('admin_cert_template', JSON.stringify(this.certTemplate));
        return;
      }
    } catch (err) {
      console.warn('Could not load template from DB:', err);
    }

    const saved = localStorage.getItem('admin_cert_template');
    if (saved) {
      try { this.certTemplate = { ...DEFAULT_TEMPLATE, ...JSON.parse(saved) }; }
      catch { this.certTemplate = { ...DEFAULT_TEMPLATE }; }
    }
  }

  private loadSavedFileIds(): void {
    const saved = localStorage.getItem('admin_cert_file_ids');
    if (saved) {
      try { this.fileIdMap = JSON.parse(saved); }
      catch { this.fileIdMap = {}; }
    }
  }

  private saveFileIds(): void {
    localStorage.setItem('admin_cert_file_ids', JSON.stringify(this.fileIdMap));
  }

  async saveTemplate(): Promise<void> {
    if (this.hasOverLimitFields()) {
      Swal.fire({
        icon: 'warning',
        title: 'Fields Too Long',
        text: 'Some fields exceed the character limit. Please shorten them before saving.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    const { depedLogoUrl, schoolLogoUrl, watermarkUrl, leftSigUrl, rightSigUrl, ...textFields } = this.certTemplate;
    const json = JSON.stringify(textFields);

    localStorage.setItem('admin_cert_template', JSON.stringify(this.certTemplate));
    this.saveFileIds();

    try {
      const user = await this.appwrite.account.get();

      let adminDocId: string | null = null;
      try {
        const res = await this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.ADMINS_COL,
          [Query.equal('auth_user_id', user.$id)]
        );
        if (res.documents.length > 0) adminDocId = res.documents[0].$id;
      } catch { /* ignore */ }

      if (!adminDocId) adminDocId = user.$id;

      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.ADMINS_COL,
        adminDocId,
        {
          cert_template_json:    json,
          cert_deped_logo_url:   this.fileIdMap['deped']     || '',
          cert_school_logo_url:  this.fileIdMap['school']    || '',
          cert_watermark_url:    this.fileIdMap['watermark'] || '',
          cert_left_sig_url:     this.fileIdMap['leftSig']   || '',
          cert_right_sig_url:    this.fileIdMap['rightSig']  || '',
        }
      );
    } catch (err) {
      console.error('Could not save template to DB:', err);
      Swal.fire({
        icon: 'warning', title: 'Saved Locally Only',
        text: 'Template saved to browser cache but failed to save to the database.',
        confirmButtonColor: '#2563eb'
      });
      this.closeSettings();
      this.splitInterns();
      return;
    }

    this.closeSettings();
    this.splitInterns();
    Swal.fire({
      icon: 'success', title: 'Template Saved!',
      toast: true, position: 'top-end',
      showConfirmButton: false, timer: 2500, timerProgressBar: true
    });
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

  // ── Data loading ──────────────────────────────────────────────────────────────

  private async fetchLastAttendanceDates(studentIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!studentIds.length) return map;

    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL,
        [
          Query.equal('status', 'Present'),
          Query.orderDesc('date'),
          Query.limit(5000)
        ]
      );
      for (const doc of res.documents as any[]) {
        const sid = doc.student_id as string;
        if (sid && studentIds.includes(sid) && !map.has(sid) && doc.date) {
          map.set(sid, doc.date as string);
        }
      }
    } catch (err) {
      console.warn('Could not fetch attendance dates:', err);
    }
    return map;
  }

  async loadInterns(): Promise<void> {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );

      const docs = res.documents as any[];

      const studentIds = docs.map(d => d.$id).filter(Boolean);
      const [lastAttMap, supervisorMap] = await Promise.all([
        this.fetchLastAttendanceDates(studentIds),
        this.fetchSupervisors(),
      ]);

      const esigFileIds = new Set<string>();
      for (const doc of docs) {
        const supId = doc.supervisor_id;
        if (supId) {
          const sup = supervisorMap.get(supId);
          if (sup?.esig_file_id) esigFileIds.add(sup.esig_file_id);
        }
      }

      const esigBase64Map = new Map<string, string>();
      await Promise.all(
        Array.from(esigFileIds).map(async (fileId) => {
          const b64 = await this.appwriteFileToBase64(this.OJT_FILES_BUCKET, fileId);
          esigBase64Map.set(fileId, b64);
        })
      );

      const mapped: Intern[] = docs.map(doc => {
        const firstName  = (doc.first_name  ?? '').trim();
        const middleName = (doc.middle_name ?? '').trim();
        const lastName   = (doc.last_name   ?? '').trim();
        const fullName   = [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Unknown Intern';

        const hoursCompleted = Number(doc.completed_hours ?? 0);
        const requiredHours  = Number(doc.required_hours  ?? this.certTemplate.requiredHours);

        const rawStart       = doc.start_date ?? doc.$createdAt ?? '';
        const rawEnd         = doc.end_date   ?? '';
        const lastAttRaw     = lastAttMap.get(doc.$id) ?? '';
        const resolvedEndRaw = lastAttRaw || rawEnd;

        const photoUrl = doc.profile_photo_id
          ? `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${doc.profile_photo_id}/view?project=${this.PROJECT_ID}`
          : '';

        const rawSentDate = doc.cert_sent_date ?? '';

        const sup = doc.supervisor_id ? supervisorMap.get(doc.supervisor_id) : null;
        const supFirstName  = (sup?.first_name ?? '').trim();
        const supLastName   = (sup?.last_name  ?? '').trim();
        const supFullName   = [supFirstName, supLastName].filter(Boolean).join(' ')
                              || this.certTemplate.supervisorName;
        const supPos        = sup?.grade_level ?? this.certTemplate.supervisorPos;
        const supEsigFileId = sup?.esig_file_id ?? '';
        const supEsigBase64 = supEsigFileId ? (esigBase64Map.get(supEsigFileId) ?? '') : '';

        return {
          $id:            doc.$id,
          name:           fullName,
          studentId:      doc.student_id  ?? '',
          course:         doc.course      ?? 'N/A',
          school:         doc.school_name ?? 'N/A',
          hoursCompleted,
          requiredHours,
          startDate:      this.formatDate(rawStart),
          endDate:        this.formatDate(resolvedEndRaw),
          photoUrl,
          sentDate:       rawSentDate ? this.formatDate(rawSentDate) : '',
          _sortDate:      resolvedEndRaw
                            ? new Date(resolvedEndRaw).getTime()
                            : new Date(rawStart).getTime(),
          _rawStartDate:  rawStart,
          _rawEndDate:    resolvedEndRaw,
          _rawSentDate:   rawSentDate,
          _certSent:      doc.cert_sent === true,
          supervisorName: supFullName,
          supervisorPos:  supPos,
          rightSigBase64: supEsigBase64,
        } as any;
      });

      this.allInterns = mapped;

      this.sentCerts = mapped
        .filter((i: any) => i._certSent === true)
        .map((i: any) => { const { _certSent, ...intern } = i; return intern as Intern; })
        .sort((a: Intern, b: Intern) => {
          const da = a._rawSentDate ? new Date(a._rawSentDate).getTime() : 0;
          const db = b._rawSentDate ? new Date(b._rawSentDate).getTime() : 0;
          return db - da;
        });

      this.splitInterns();
    } catch (err) {
      console.error('Failed to load interns:', err);
      this.loadMockData();
    }
  }

  private splitInterns(): void {
    const sentIds = new Set(this.sentCerts.map(s => s.$id));

    this.completedInterns = this.allInterns
      .filter(i => i.hoursCompleted >= i.requiredHours && !sentIds.has(i.$id))
      .sort((a, b) => (b._sortDate ?? 0) - (a._sortDate ?? 0));

    this.ongoingInterns = this.allInterns
      .filter(i => i.hoursCompleted < i.requiredHours && !sentIds.has(i.$id))
      .sort((a, b) => b.hoursCompleted - a.hoursCompleted);

    this.currentPage = 1;
  }

  private loadMockData(): void {
    this.allInterns = [
      { $id: '1', name: 'Maria Clara Santos',    supervisorName: 'Maria Santos', supervisorPos: 'OJT Supervisor', rightSigBase64: '', studentId: 'STU-001', course: 'BSIT', school: 'PUP',            hoursCompleted: 500, requiredHours: 500, startDate: 'January 6, 2025',  endDate: 'May 16, 2025', photoUrl: '', _sortDate: new Date('2025-05-16').getTime(), _rawStartDate: '2025-01-06', _rawEndDate: '2025-05-16' },
      { $id: '2', name: 'Juan Pablo Reyes',      supervisorName: 'Maria Santos', supervisorPos: 'OJT Supervisor', rightSigBase64: '', studentId: 'STU-002', course: 'BSCS', school: 'Gordon College', hoursCompleted: 500, requiredHours: 500, startDate: 'January 6, 2025',  endDate: 'May 10, 2025', photoUrl: '', _sortDate: new Date('2025-05-10').getTime(), _rawStartDate: '2025-01-06', _rawEndDate: '2025-05-10' },
      { $id: '3', name: 'Angela Marie Cruz',     supervisorName: 'Maria Santos', supervisorPos: 'OJT Supervisor', rightSigBase64: '', studentId: 'STU-003', course: 'BSED', school: 'Holy Angels',    hoursCompleted: 320, requiredHours: 500, startDate: 'February 3, 2025', endDate: '',             photoUrl: '', _sortDate: 0, _rawStartDate: '2025-02-03', _rawEndDate: '' },
      { $id: '4', name: 'Ricardo Jose Flores',   supervisorName: 'Maria Santos', supervisorPos: 'OJT Supervisor', rightSigBase64: '', studentId: 'STU-004', course: 'BSIT', school: 'DMMMSU',         hoursCompleted: 410, requiredHours: 500, startDate: 'February 3, 2025', endDate: '',             photoUrl: '', _sortDate: 0, _rawStartDate: '2025-02-03', _rawEndDate: '' },
      { $id: '5', name: 'Sophia Nicole Bautista', supervisorName: 'Maria Santos', supervisorPos: 'OJT Supervisor', rightSigBase64: '', studentId: 'STU-005', course: 'BSBA', school: 'Columban',       hoursCompleted: 180, requiredHours: 500, startDate: 'March 3, 2025',    endDate: '',             photoUrl: '', _sortDate: 0, _rawStartDate: '2025-03-03', _rawEndDate: '' },
    ];
    this.splitInterns();
  }

  // ── Filtered + sorted lists ───────────────────────────────────────────────────

  private filterList(list: Intern[]): Intern[] {
    let result = list;
    const q = this.searchQuery.toLowerCase();
    if (q) {
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.studentId || '').toLowerCase().includes(q) ||
        i.course.toLowerCase().includes(q)
      );
    }
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

  getPct(intern: Intern): number {
    return Math.min(100, Math.round((intern.hoursCompleted / intern.requiredHours) * 100));
  }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  getBodyText(intern: Intern): string {
    const raw = this.certTemplate.bodyText || '';
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/\{name\}/g,   `<strong>${this.escapeHtml(intern.name)}</strong>`)
      .replace(/\{hours\}/g,  `<strong>${intern.hoursCompleted}</strong>`)
      .replace(/\{course\}/g, `<strong>${this.escapeHtml(intern.course)}</strong>`)
      .replace(/\{school\}/g, `<strong>${this.escapeHtml(intern.school)}</strong>`)
      .replace(/\{host\}/g,   `<strong>${this.escapeHtml(this.certTemplate.hostSchool)}</strong>`);
  }

  getGivenText(intern: Intern): string {
    const date = intern.endDate
      ? intern.endDate
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const location = this.certTemplate.schoolName;
    return (this.certTemplate.givenText || '')
      .replace(/\{date\}/g,     date)
      .replace(/\{location\}/g, location);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    this.openDotMenu     = null;
    this.showSortPanel   = false;
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

  async confirmSendCert(): Promise<void> {
    if (!this.sendTarget) return;
    const intern     = this.sendTarget;
    const today      = new Date();
    const todayIso   = today.toISOString();
    const todayFmt   = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    try {
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        intern.$id,
        { cert_sent: true, cert_sent_date: todayIso }
      );
    } catch (err) {
      console.error('Failed to update cert_sent in DB:', err);
      Swal.fire({
        icon: 'error',
        title: 'DB Error',
        text: 'Could not save cert status to the database. Please try again.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    const sentIntern: Intern = {
      ...intern,
      sentDate:     todayFmt,
      _rawSentDate: todayIso,
    };

    this.sentCerts.unshift(sentIntern);
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

    const wasOpen     = this.showCertPreview;
    const savedScale  = this.certScale;
    const savedTransX = this.certTransX;
    const savedTransY = this.certTransY;

    this.certScale       = 1;
    this.certTransX      = 0;
    this.certTransY      = 0;
    this.selectedIntern  = intern;
    this.showCertPreview = true;

    setTimeout(async () => {
      const certEl = document.getElementById('certificate-preview');
      if (!certEl) {
        this.certScale  = savedScale;
        this.certTransX = savedTransX;
        this.certTransY = savedTransY;
        if (!wasOpen) this.showCertPreview = false;
        return;
      }

      try {
        const canvas = await html2canvas(certEl, {
          scale:           3,
          useCORS:         false,
          allowTaint:      false,
          backgroundColor: '#ffffff',
          windowWidth:     certEl.scrollWidth,
          windowHeight:    certEl.scrollHeight,
          x: 0, y: 0, scrollX: 0, scrollY: 0,
          onclone: (clonedDoc) => {
            const transformWrap = clonedDoc.querySelector('.cert-pan-transform') as HTMLElement;
            if (transformWrap) transformWrap.style.transform = 'none';
            const scrollArea = clonedDoc.querySelector('.cert-scroll-area') as HTMLElement;
            if (scrollArea) {
              scrollArea.style.overflow  = 'visible';
              scrollArea.style.transform = 'none';
            }
          }
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
        pdf.save(`Certificate_${intern.name.replace(/\s+/g, '_')}.pdf`);

      } catch (err) {
        console.error('PDF generation failed:', err);
        Swal.fire({
          icon: 'error', title: 'Download Failed',
          text: 'Could not generate the PDF. Please try again.',
          confirmButtonColor: '#2563eb'
        });
      }

      this.certScale  = savedScale;
      this.certTransX = savedTransX;
      this.certTransY = savedTransY;
      if (!wasOpen) setTimeout(() => { this.showCertPreview = false; }, 500);
    }, 400);
  }

  // ── Logo & Signature Uploads ──────────────────────────────────────────────────

  onLogoChange(event: Event, type: 'deped' | 'school' | 'watermark' | 'leftSig' | 'rightSig'): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // ── PNG-only validation ──
    if (file.type !== 'image/png') {
      Swal.fire({
        icon: 'warning',
        title: 'PNG Only',
        text: 'Please upload a PNG image file. Other formats (JPG, GIF, WebP, etc.) are not accepted.',
        confirmButtonColor: '#2563eb'
      });
      // Reset the input so the same file can be re-selected after user corrects it
      (event.target as HTMLInputElement).value = '';
      return;
    }

    this.uploadFile(file, type);
  }

  onLogoDrop(event: DragEvent, type: 'deped' | 'school' | 'watermark' | 'leftSig' | 'rightSig'): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    // ── PNG-only validation ──
    if (file.type !== 'image/png') {
      Swal.fire({
        icon: 'warning',
        title: 'PNG Only',
        text: 'Please drop a PNG image file. Other formats are not accepted.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    this.uploadFile(file, type);
  }

  async removeFile(type: 'deped' | 'school' | 'watermark' | 'leftSig' | 'rightSig'): Promise<void> {
    const oldFileId = this.fileIdMap[type];
    if (oldFileId) {
      try {
        await this.appwrite.storage.deleteFile(this.OJT_FILES_BUCKET, oldFileId);
      } catch (e) {
        console.warn('Could not delete old file (may already be gone):', e);
      }
      delete this.fileIdMap[type];
      this.saveFileIds();
    }
    if (type === 'deped')     this.certTemplate.depedLogoUrl  = '';
    if (type === 'school')    this.certTemplate.schoolLogoUrl = '';
    if (type === 'watermark') this.certTemplate.watermarkUrl  = '';
    if (type === 'leftSig')   this.certTemplate.leftSigUrl    = '';
    if (type === 'rightSig')  this.certTemplate.rightSigUrl   = '';
  }

  private async uploadFile(
    file: File,
    type: 'deped' | 'school' | 'watermark' | 'leftSig' | 'rightSig'
  ): Promise<void> {
    try {
      const oldFileId = this.fileIdMap[type];
      if (oldFileId) {
        try { await this.appwrite.storage.deleteFile(this.OJT_FILES_BUCKET, oldFileId); }
        catch (e) { console.warn('Could not delete old file:', e); }
      }

      const newFileId = ID.unique();
      await this.appwrite.storage.createFile(this.OJT_FILES_BUCKET, newFileId, file);

      const base64 = await this.fileToBase64(file);

      this.fileIdMap[type] = newFileId;
      this.saveFileIds();

      if (type === 'deped')     this.certTemplate.depedLogoUrl  = base64;
      if (type === 'school')    this.certTemplate.schoolLogoUrl = base64;
      if (type === 'watermark') this.certTemplate.watermarkUrl  = base64;
      if (type === 'leftSig')   this.certTemplate.leftSigUrl    = base64;
      if (type === 'rightSig')  this.certTemplate.rightSigUrl   = base64;

    } catch (err) {
      console.error('File upload failed:', err);
      Swal.fire({
        icon: 'error', title: 'Upload Failed',
        text: 'Could not upload the image.',
        confirmButtonColor: '#2563eb'
      });
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror   = reject;
      reader.readAsDataURL(file);
    });
  }

  private async appwriteFileToBase64(bucketId: string, fileId: string): Promise<string> {
    if (!fileId) return '';
    if (fileId.startsWith('data:')) return fileId;

    try {
      const jwt = await this.appwrite.account.createJWT();
      const url = `${this.ENDPOINT}/storage/buckets/${bucketId}/files/${fileId}/view?project=${this.PROJECT_ID}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Appwrite-JWT':     jwt.jwt,
          'X-Appwrite-Project': this.PROJECT_ID,
        },
      });

      if (!response.ok) {
        console.warn(`appwriteFileToBase64: fetch failed ${response.status} for fileId=${fileId}`);
        return '';
      }

      const blob   = await response.blob();
      const base64 = await this.fileToBase64(blob as File);
      return base64;

    } catch (err) {
      console.warn('appwriteFileToBase64 failed:', err);
      return '';
    }
  }

  private async fetchSupervisors(): Promise<Map<string, any>> {
    const map = new Map<string, any>();
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL,
        [Query.limit(500)]
      );
      for (const doc of res.documents as any[]) {
        map.set(doc.$id, doc);
      }
    } catch (err) {
      console.warn('Could not fetch supervisors:', err);
    }
    return map;
  }

  // ── Character limit helpers ───────────────────────────────────────────────────

  getCharCount(field: keyof typeof this.FIELD_LIMITS): number {
    const val = (this.certTemplate as any)[field];
    return typeof val === 'string' ? val.length : 0;
  }

  isNearLimit(field: keyof typeof this.FIELD_LIMITS): boolean {
    const count = this.getCharCount(field);
    const limit = this.FIELD_LIMITS[field];
    return count >= Math.floor(limit * 0.85) && count <= limit;
  }

  isOverLimit(field: keyof typeof this.FIELD_LIMITS): boolean {
    return this.getCharCount(field) > this.FIELD_LIMITS[field];
  }

  hasOverLimitFields(): boolean {
    return Object.keys(this.FIELD_LIMITS).some(k =>
      this.isOverLimit(k as keyof typeof this.FIELD_LIMITS)
    );
  }
}