import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import { Query } from 'appwrite';

interface Student {
  $id: string;
  student_doc_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  student_id: string;
  email: string;
  contact_number?: string;
  birthday?: string;
  gender?: string;
  home_address?: string;
  school_name?: string;
  course?: string;
  year_level?: string;
  profile_photo_id?: string;
  required_hours?: number;
  completed_hours?: number;
  ojt_start: string;
  ojt_end: string;
  archived_at: string;
  supervisor_id?: string;
  supervisorName?: string;
}

interface AttendanceLog {
  date: string;
  time_in: string;
  time_out: string;
  status: string;
}

interface CertTemplate {
  republic:      string;
  department:    string;
  division:      string;
  schoolName:    string;
  address:       string;
  depedLogoUrl:  string;
  schoolLogoUrl: string;
  [key: string]: any;
}

const DEFAULT_CERT_TEMPLATE: CertTemplate = {
  republic:      'Republic of the Philippines',
  department:    'Department of Education',
  division:      'Schools Division of Olongapo City',
  schoolName:    'Olongapo City Elementary School',
  address:       'Olongapo City, Zambales',
  depedLogoUrl:  '',
  schoolLogoUrl: '',
};

@Component({
  selector: 'app-admin-completed-ojt',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    AdminSidenavComponent,
    AdminTopnavComponent
  ],
  templateUrl: './admin-completed-ojt.component.html',
  styleUrls: ['./admin-completed-ojt.component.css']
})
export class AdminCompletedOjtComponent implements OnInit {

  isCollapsed = false;
  loading     = false;

  students        : Student[] = [];
  filteredStudents: Student[] = [];
  searchQuery = '';

  currentPage = 1;
  pageSize    = 10;

  showModal               = false;
  selectedStudent         : Student | null = null;
  showAttendanceLogsModal = false;

  attendanceLogs    : AttendanceLog[] = [];
  filteredLogs      : AttendanceLog[] = [];
  attendanceLoading = false;
  filterMonth       = '';
  filterYear        = '';

  readonly months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  years: number[] = [];

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  private certTemplate: CertTemplate = { ...DEFAULT_CERT_TEMPLATE };

  private readonly COURSE_MAP: { [key: string]: string } = {
    'bachelor of science in information technology':              'BSIT',
    'bachelor of science in computer science':                    'BSCS',
    'bachelor of science in computer engineering':                'BSCpE',
    'bachelor of science in information systems':                 'BSIS',
    'bachelor of science in data science':                        'BSDS',
    'bachelor of science in artificial intelligence':             'BSAI',
    'bachelor of science in cybersecurity':                       'BSCySec',
    'bachelor of science in software engineering':                'BSSE',
    'bachelor of science in electronics engineering':             'BSECE',
    'bachelor of science in electronics and communications engineering': 'BSECE',
    'bachelor of science in electrical engineering':              'BSEE',
    'bachelor of science in civil engineering':                   'BSCE',
    'bachelor of science in mechanical engineering':              'BSME',
    'bachelor of science in industrial engineering':              'BSIE',
    'bachelor of science in chemical engineering':                'BSChE',
    'bachelor of science in geodetic engineering':                'BSGE',
    'bachelor of science in mining engineering':                  'BSMinE',
    'bachelor of science in marine engineering':                  'BSMarE',
    'bachelor of science in marine transportation':               'BSMT',
    'bachelor of science in naval architecture and marine engineering': 'BSNAME',
    'bachelor of science in aeronautical engineering':            'BSAeroE',
    'bachelor of science in agricultural engineering':            'BSAgriE',
    'bachelor of science in environmental engineering':           'BSEnvE',
    'bachelor of science in materials engineering':               'BSMatE',
    'bachelor of science in metallurgical engineering':           'BSMetE',
    'bachelor of science in mechatronics engineering':            'BSMechatronics',
    'bachelor of science in business administration':             'BSBA',
    'bachelor of science in accountancy':                         'BSA',
    'bachelor of science in management accounting':               'BSMA',
    'bachelor of science in entrepreneurship':                    'BSEntrep',
    'bachelor of science in real estate management':              'BSREM',
    'bachelor of science in office administration':               'BSOA',
    'bachelor of science in customs administration':              'BSCA',
    'bachelor of science in public administration':               'BSPA',
    'bachelor of science in nursing':                             'BSN',
    'bachelor of science in pharmacy':                            'BSPharm',
    'bachelor of science in medical technology':                  'BSMT',
    'bachelor of science in physical therapy':                    'BSPT',
    'bachelor of science in occupational therapy':                'BSOT',
    'bachelor of science in radiologic technology':               'BSRT',
    'bachelor of science in nutrition and dietetics':             'BSND',
    'bachelor of science in midwifery':                           'BSMid',
    'bachelor of science in biology':                             'BSBio',
    'bachelor of science in chemistry':                           'BSChem',
    'bachelor of science in physics':                             'BSPhysics',
    'bachelor of science in mathematics':                         'BSMath',
    'bachelor of science in statistics':                          'BSStat',
    'bachelor of science in psychology':                          'BSPsych',
    'bachelor of science in geology':                             'BSGeology',
    'bachelor of science in agriculture':                         'BSAgri',
    'bachelor of science in forestry':                            'BSF',
    'bachelor of science in fisheries':                           'BSFisheries',
    'bachelor of science in environmental science':               'BSES',
    'bachelor of secondary education':                            'BSEd',
    'bachelor of elementary education':                           'BEEd',
    'bachelor of physical education':                             'BPEd',
    'bachelor of early childhood education':                      'BECED',
    'bachelor of special needs education':                        'BSNED',
    'bachelor of technical-vocational teacher education':         'BTVTED',
    'bachelor of science in architecture':                        'BSArch',
    'bachelor of landscape architecture':                         'BLA',
    'bachelor of interior design':                                'BID',
    'bachelor of fine arts':                                      'BFA',
    'bachelor of arts in communication':                          'BAComm',
    'bachelor of arts in english':                                'BAEng',
    'bachelor of arts in political science':                      'BAPol',
    'bachelor of arts in sociology':                              'BASoc',
    'bachelor of arts in philosophy':                             'BAPhil',
    'bachelor of arts in history':                                'BAHist',
    'bachelor of arts in economics':                              'BAEcon',
    'bachelor of arts in journalism':                             'BAJ',
    'bachelor of science in social work':                         'BSSW',
    'bachelor of science in criminology':                         'BSCrim',
    'bachelor of science in foreign service':                     'BSFS',
    'bachelor of science in tourism management':                  'BSTM',
    'bachelor of science in hospitality management':              'BSHM',
    'bachelor of science in hotel and restaurant management':     'BSHRM',
    'bachelor of science in travel management':                   'BSTRM',
    'bachelor of laws':                                           'LLB',
    'juris doctor':                                               'JD',
    'bachelor of science in legal management':                    'BSLM',
    'bachelor of technology':                                     'BTech',
    'diploma in information technology':                          'DIT',
    'bachelor of music':                                          'BMus',
    'bachelor of performing arts':                                'BPA',
  };

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    this.populateYears();
    this.loadCertTemplate();
    await this.loadCompletedStudents();
  }

  private loadCertTemplate(): void {
    try {
      const saved = localStorage.getItem('admin_cert_template');
      if (saved) {
        this.certTemplate = { ...DEFAULT_CERT_TEMPLATE, ...JSON.parse(saved) };
      }
    } catch {
      this.certTemplate = { ...DEFAULT_CERT_TEMPLATE };
    }
  }

  async loadCompletedStudents() {
    this.loading = true;
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ARCHIVES_COL,
        [Query.limit(500)]
      );

      const docs = (res.documents as any[]).sort((a, b) =>
        new Date(b.ojt_start || b.archived_at).getTime() -
        new Date(a.ojt_start || a.archived_at).getTime()
      );

      this.students         = docs;
      this.filteredStudents = [...this.students];

      await this.loadSupervisorNames();
      await this.fillMissingOjtDates();

    } catch (error: any) {
      console.error('Failed to load archived students:', error.message);
    } finally {
      this.loading = false;
    }
  }

  async loadSupervisorNames() {
    const supervisorIds = [...new Set(
      this.students.map(s => s.supervisor_id).filter(Boolean)
    )];
    const supervisorMap: Record<string, string> = {};
    await Promise.all(supervisorIds.map(async (id) => {
      try {
        const doc = await this.appwrite.databases.getDocument(
          this.appwrite.DATABASE_ID,
          this.appwrite.SUPERVISORS_COL,
          id!
        );
        supervisorMap[id!] = `${doc['first_name']} ${doc['last_name']}`;
      } catch { supervisorMap[id!] = 'Unknown'; }
    }));
    this.students = this.students.map(s => ({
      ...s,
      supervisorName: s.supervisor_id ? supervisorMap[s.supervisor_id] ?? '—' : '—'
    }));
    this.filteredStudents = [...this.students];
  }

  async fillMissingOjtDates() {
    const need = this.students.filter(s => !s.ojt_start || !s.ojt_end);
    if (!need.length) return;
    await Promise.all(need.map(async (student) => {
      try {
        const res = await this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.ATTENDANCE_COL,
          [
            Query.equal('student_id', student.student_doc_id),
            Query.orderAsc('date'), Query.limit(500)
          ]
        );
        const dates = (res.documents as any[]).map(d => d.date).filter(Boolean).sort();
        if (dates.length > 0) {
          student.ojt_start = student.ojt_start || dates[0];
          student.ojt_end   = student.ojt_end   || dates[dates.length - 1];
        }
      } catch (e: any) {
        console.warn(`Could not load attendance for ${student.student_doc_id}:`, e.message);
      }
    }));
    this.filteredStudents = [...this.students];
  }

  get pagedStudents(): Student[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredStudents.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredStudents.length / this.pageSize) || 1;
  }

  get ghostRows(): null[] {
    const empty = this.pageSize - this.pagedStudents.length;
    return empty > 0 ? Array(empty).fill(null) : [];
  }

  get rangeStart(): number {
    return this.filteredStudents.length === 0
      ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredStudents.length);
  }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  prevPage() { this.goToPage(this.currentPage - 1); }
  nextPage() { this.goToPage(this.currentPage + 1); }

  onSearch(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.currentPage = 1;
    this.filteredStudents = this.students.filter(s => {
      const name = `${s.first_name} ${s.middle_name ?? ''} ${s.last_name}`.toLowerCase();
      return name.includes(this.searchQuery) ||
             s.student_id.toLowerCase().includes(this.searchQuery) ||
             s.email.toLowerCase().includes(this.searchQuery);
    });
  }

  async loadAttendanceLogs(student: Student) {
    this.attendanceLoading = true;
    this.attendanceLogs    = [];
    this.filteredLogs      = [];
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.ATTENDANCE_COL,
        [
          Query.equal('student_id', student.student_doc_id),
          Query.orderDesc('date'),
          Query.limit(500)
        ]
      );
      this.attendanceLogs = (res.documents as any[]).map(doc => ({
        date:     doc.date,
        time_in:  doc.time_in  || '—',
        time_out: doc.time_out || '—',
        status:   doc.status
      }));
      this.filteredLogs = [...this.attendanceLogs];
    } catch (error: any) {
      console.error('Failed to load attendance logs:', error.message);
    } finally {
      this.attendanceLoading = false;
    }
  }

  applyAttendanceFilter() {
    this.filteredLogs = this.attendanceLogs.filter(log => {
      const d = new Date(log.date);
      if (this.filterMonth && d.getMonth() + 1 !== +this.filterMonth) return false;
      if (this.filterYear  && d.getFullYear()  !== +this.filterYear)  return false;
      return true;
    });
  }

  clearAttendanceFilter() {
    this.filterMonth  = '';
    this.filterYear   = '';
    this.filteredLogs = [...this.attendanceLogs];
  }

  openModal(student: Student) {
    this.selectedStudent         = student;
    this.showModal               = true;
    this.showAttendanceLogsModal = false;
    this.attendanceLogs          = [];
    this.filteredLogs            = [];
  }

  closeModal() {
    this.showModal               = false;
    this.selectedStudent         = null;
    this.showAttendanceLogsModal = false;
    this.attendanceLogs          = [];
    this.filteredLogs            = [];
    this.filterMonth             = '';
    this.filterYear              = '';
  }

  async openAttendanceLogsModal() {
    this.showAttendanceLogsModal = true;
    this.filterMonth = '';
    this.filterYear  = '';
    if (this.attendanceLogs.length === 0) {
      await this.loadAttendanceLogs(this.selectedStudent!);
    } else {
      this.filteredLogs = [...this.attendanceLogs];
    }
  }

  closeAttendanceLogsModal() {
    this.showAttendanceLogsModal = false;
    this.filterMonth             = '';
    this.filterYear              = '';
  }

  abbreviateCourse(course: string): string {
    if (!course) return '—';
    const key = course.trim().toLowerCase();
    if (this.COURSE_MAP[key]) return this.COURSE_MAP[key];
    const skip = new Set(['of','in','and','the','a','an','for','&']);
    return course.trim().split(/\s+/)
      .filter(w => !skip.has(w.toLowerCase()))
      .map(w => w.charAt(0).toUpperCase() + (w.length > 3 ? w.charAt(1).toLowerCase() : ''))
      .join('') || course;
  }

  onToggleSidebar(c: boolean) { this.isCollapsed = c; }

  populateYears() {
    const y = new Date().getFullYear();
    this.years = Array.from({ length: 6 }, (_, i) => y - i);
  }

  getFullName(s: Student | null): string {
    if (!s) return '';
    return `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`;
  }

  getStartDate(s: Student | null): string {
    if (!s?.ojt_start) return '—';
    return new Date(s.ojt_start).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  getEndDate(s: Student | null): string {
    if (!s?.ojt_end) return '—';
    return new Date(s.ojt_end).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const p = dateStr.split('-');
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  getAvatarUrl(s: Student | null): string {
    if (!s) return '';
    if (s.profile_photo_id)
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${s.profile_photo_id}/view?project=${this.PROJECT_ID}`;
    const i = `${s.first_name.charAt(0)} ${s.last_name.charAt(0)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(i)}&background=2563eb&color=fff&size=64`;
  }

  getRemainingHours(s: Student | null): number {
    if (!s) return 0;
    return Math.max((s.required_hours || 500) - (s.completed_hours || 0), 0);
  }

  // ── Load image URL or base64 → usable base64 string ──────
  private loadImageAsBase64(url: string): Promise<string | null> {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      if (url.startsWith('data:')) return resolve(url);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        try { resolve(canvas.toDataURL('image/png')); }
        catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // ── Download Attendance PDF ───────────────────────────────
  async downloadAttendanceLogs() {
    if (!this.filteredLogs.length) return;

    this.loadCertTemplate();
    const tmpl = this.certTemplate;

    import('jspdf').then(async (module: any) => {
      const jsPDF = module.jsPDF;

      const name      = this.getFullName(this.selectedStudent);
      const studentId = this.selectedStudent?.student_id || 'N/A';
      const course    = this.selectedStudent?.course     || 'N/A';

      // Pre-load logos
      const [depedImg, schoolImg] = await Promise.all([
        this.loadImageAsBase64(tmpl.depedLogoUrl  || ''),
        this.loadImageAsBase64(tmpl.schoolLogoUrl || ''),
      ]);

      const doc        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth  = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin     = 20;
      const centerX    = pageWidth / 2;

      // ── HEADER ──────────────────────────────────────────────
      // Logos sit on the sides, text centered between them
      // Logo size: square 22 mm, vertically centered in a ~30 mm header zone

      const logoSize  = 22;
      const headerY   = 12;   // top of logo

      // Center the entire header block first, then place logos just beside the text
      // We'll calculate text center = page center, logos snug beside the text block
      const textBlockWidth = 90; // approx width of centered text
      const textCX = centerX;
      const logoLeftX  = textCX - textBlockWidth / 2 - logoSize - 2;
      const logoRightX = textCX + textBlockWidth / 2 + 2;

      // Clamp logos so they don't go past the page margin
      const clampedLogoLeftX  = Math.max(margin, logoLeftX);
      const clampedLogoRightX = Math.min(pageWidth - margin - logoSize, logoRightX);

      if (depedImg) {
        doc.addImage(depedImg, 'PNG', clampedLogoLeftX, headerY, logoSize, logoSize);
      }
      if (schoolImg) {
        doc.addImage(schoolImg, 'PNG', clampedLogoRightX, headerY, logoSize, logoSize);
      }

      let textY = headerY + 4;

      doc.setFontSize(7.5);
      doc.setFont('times', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(tmpl.republic || 'Republic of the Philippines', textCX, textY, { align: 'center' });
      textY += 4.5;

      doc.setFontSize(9);
      doc.setFont('times', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(tmpl.department || 'Department of Education', textCX, textY, { align: 'center' });
      textY += 4.5;

      doc.setFontSize(8);
      doc.setFont('times', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(tmpl.division || '', textCX, textY, { align: 'center' });
      textY += 4.5;

      doc.setFontSize(11);
      doc.setFont('times', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(tmpl.schoolName || 'School Name', textCX, textY, { align: 'center' });
      textY += 4.5;

      doc.setFontSize(7.5);
      doc.setFont('times', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(tmpl.address || '', textCX, textY, { align: 'center' });

      // Single divider line below header
      const dividerY = headerY + logoSize + 3;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, dividerY, pageWidth - margin, dividerY);

      // ── DOCUMENT TITLE ────────────────────────────────────
      let yPos = dividerY + 10;

      doc.setFontSize(13);
      doc.setFont('times', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('ATTENDANCE REPORT', centerX, yPos, { align: 'center' });
      yPos += 9;

      // ── STUDENT INFO ─────────────────────────────────────
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);

      const labelX = margin;
      const valueX = margin + 33;

      const infoRows: [string, string][] = [
        ['Name',       name],
        ['Student ID', studentId],
        ['Course',     course],
        ['School',     this.selectedStudent?.school_name || '—'],
        ['OJT Period', `${this.getStartDate(this.selectedStudent)} – ${this.getEndDate(this.selectedStudent)}`],
        ['Supervisor', this.selectedStudent?.supervisorName || '—'],
      ];

      if (this.filterMonth || this.filterYear) {
        const filterStr = [
          this.filterMonth ? this.months[+this.filterMonth - 1] : '',
          this.filterYear  ? this.filterYear                    : ''
        ].filter(Boolean).join(' ');
        infoRows.push(['Period Filter', filterStr]);
      }

      infoRows.forEach(([label, value], idx) => {
        doc.setFont('times', 'bold');
        doc.text(`${label}:`, labelX, yPos);
        doc.setFont('times', 'normal');
        const lines = doc.splitTextToSize(value, pageWidth - margin - valueX - 5);
        doc.text(lines, valueX, yPos);
        yPos += lines.length > 1 ? lines.length * 5 : 5.5;

        // Divider after the last info row (Supervisor or Period Filter)
        if (idx === infoRows.length - 1) {
          yPos += 2;
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.3);
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 5;
        }
      });

      // ── TABLE ─────────────────────────────────────────────
      // Columns: #, Date, Time In, Time Out, Status
      const colWidths = [12, 68, 30, 30, 30];
      const headers   = ['#', 'Date', 'Time In', 'Time Out', 'Status'];
      const tableW    = colWidths.reduce((a, b) => a + b, 0);

      // Table header — bold labels, underline only
      doc.setFontSize(9);
      doc.setFont('times', 'bold');
      doc.setTextColor(0, 0, 0);
      let xCursor = margin;
      headers.forEach((h, i) => {
        doc.text(h, xCursor + 1.5, yPos + 4);
        xCursor += colWidths[i];
      });
      yPos += 6;

      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      doc.line(margin, yPos, margin + tableW, yPos);
      yPos += 1;

      // Data rows
      const rowH = 6.5;
      doc.setFontSize(9);
      doc.setFont('times', 'normal');
      doc.setTextColor(0, 0, 0);

      this.filteredLogs.forEach((log, index) => {
        // New page
        if (yPos + rowH > pageHeight - 20) {
          doc.addPage();
          yPos = 20;

          doc.setFont('times', 'bold');
          doc.setLineWidth(0.5);
          xCursor = margin;
          headers.forEach((h, i) => {
            doc.text(h, xCursor + 1.5, yPos + 4);
            xCursor += colWidths[i];
          });
          yPos += 6;
          doc.line(margin, yPos, margin + tableW, yPos);
          yPos += 1;
          doc.setFont('times', 'normal');
        }

        const rowData = [
          `${index + 1}`,
          this.formatDate(log.date),
          log.time_in,
          log.time_out,
          log.status
        ];

        xCursor = margin;
        rowData.forEach((cell, colIdx) => {
          doc.setTextColor(0, 0, 0);
          doc.text(String(cell), xCursor + 1.5, yPos + 4.5);
          xCursor += colWidths[colIdx];
        });

        // Light row separator
        doc.setLineWidth(0.1);
        doc.setDrawColor(180, 180, 180);
        doc.line(margin, yPos + rowH, margin + tableW, yPos + rowH);
        doc.setDrawColor(0, 0, 0);

        yPos += rowH;
      });

      // Final border
      doc.setLineWidth(0.5);
      doc.line(margin, yPos + 1, margin + tableW, yPos + 1);
      yPos += 6;

      // Total count
      doc.setFontSize(8.5);
      doc.setFont('times', 'italic');
      doc.setTextColor(60, 60, 60);
      doc.text(`Total Records: ${this.filteredLogs.length}`, margin, yPos);

      // ── FOOTER ────────────────────────────────────────────
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont('times', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Page ${i} of ${pageCount}`,
          centerX, pageHeight - 8,
          { align: 'center' }
        );
        doc.text(
          `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
          margin, pageHeight - 8
        );
      }

      // Save
      const monthStr  = this.filterMonth ? `_${this.months[+this.filterMonth - 1]}` : '';
      const yearStr   = this.filterYear  ? `_${this.filterYear}`                    : '';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename  = `${name.replace(/\s+/g, '_')}_Attendance${monthStr}${yearStr}_${timestamp}.pdf`;
      doc.save(filename);

    }).catch((error: any) => {
      console.error('PDF Error:', error);
      alert('Error generating PDF. Make sure jspdf is installed: npm install jspdf');
    });
  }
}