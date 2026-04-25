import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
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
  cert_sent?: boolean;
  supervisor_id?: string;
  ojt_start?: string;
  ojt_end?: string;
  $createdAt: string;
}

@Component({
  selector: 'app-admin-ojt',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AdminSidenavComponent,
    AdminTopnavComponent
  ],
  templateUrl: './admin-ojt.component.html',
  styleUrl: './admin-ojt.component.css'
})
export class AdminOjtComponent implements OnInit {

  students        : Student[] = [];
  filteredStudents: Student[] = [];
  loading         = false;
  searchQuery     = '';
  isCollapsed     = false;
  archivingId: string | null = null;
  evaluatedStudentIds: Set<string> = new Set();

  // PAGINATION
  currentPage  = 1;
  pageSize     = 10;
  readonly Math = Math;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';
  readonly APPWRITE_PAGE_SIZE = 100;

  // ── Comprehensive course abbreviation map ──────────────────
  private readonly COURSE_MAP: { [key: string]: string } = {
    // Information Technology & Computing
    'bachelor of science in information technology':              'BSIT',
    'bachelor of science in computer science':                    'BSCS',
    'bachelor of science in computer engineering':                'BSCpE',
    'bachelor of science in information systems':                 'BSIS',
    'bachelor of science in data science':                        'BSDS',
    'bachelor of science in artificial intelligence':             'BSAI',
    'bachelor of science in cybersecurity':                       'BSCySec',
    'bachelor of science in software engineering':                'BSSE',

    // Engineering
    'bachelor of science in electronics engineering':             'BSECE',
    'bachelor of science in electronics and communications engineering': 'BSECE',
    'bachelor of science in electrical engineering':              'BSEE',
    'bachelor of science in civil engineering':                   'BSCE',
    'bachelor of science in mechanical engineering':              'BSME',
    'bachelor of science in industrial engineering':              'BSIE',
    'bachelor of science in chemical engineering':                'BSChE',
    'bachelor of science in geodetic engineering':                'BSGE',
    'bachelor of science in mining engineering':                  'BSMinE',
    'bachelor of science in petroleum engineering':               'BSPetE',
    'bachelor of science in sanitary engineering':                'BSSE',
    'bachelor of science in marine engineering':                  'BSMarE',
    'bachelor of science in marine transportation':               'BSMT',
    'bachelor of science in naval architecture and marine engineering': 'BSNAME',
    'bachelor of science in aeronautical engineering':            'BSAeroE',
    'bachelor of science in agricultural engineering':            'BSAgriE',
    'bachelor of science in environmental engineering':           'BSEnvE',
    'bachelor of science in materials engineering':               'BSMatE',
    'bachelor of science in metallurgical engineering':           'BSMetE',
    'bachelor of science in mechatronics engineering':            'BSMechatronics',

    // Business & Management
    'bachelor of science in business administration':             'BSBA',
    'bachelor of science in accountancy':                         'BSA',
    'bachelor of science in management accounting':               'BSMA',
    'bachelor of science in entrepreneurship':                    'BSEntrep',
    'bachelor of science in real estate management':              'BSREM',
    'bachelor of science in office administration':               'BSOA',
    'bachelor of science in customs administration':              'BSCA',
    'bachelor of science in public administration':               'BSPA',

    // Health & Medical
    'bachelor of science in nursing':                             'BSN',
    'bachelor of science in pharmacy':                            'BSPharm',
    'bachelor of science in medical technology':                  'BSMT',
    'bachelor of science in physical therapy':                    'BSPT',
    'bachelor of science in occupational therapy':                'BSOT',
    'bachelor of science in radiologic technology':               'BSRT',
    'bachelor of science in respiratory therapy':                 'BSRESPTH',
    'bachelor of science in nutrition and dietetics':             'BSND',
    'bachelor of science in midwifery':                           'BSMid',
    'bachelor of science in dentistry':                           'BSD',
    'doctor of medicine':                                         'MD',
    'doctor of dental medicine':                                  'DMD',

    // Sciences
    'bachelor of science in biology':                             'BSBio',
    'bachelor of science in chemistry':                           'BSChem',
    'bachelor of science in physics':                             'BSPhysics',
    'bachelor of science in mathematics':                         'BSMath',
    'bachelor of science in statistics':                          'BSStat',
    'bachelor of science in psychology':                          'BSPsych',
    'bachelor of science in geology':                             'BSGeology',
    'bachelor of science in meteorology':                         'BSMeteorology',
    'bachelor of science in agriculture':                         'BSAgri',
    'bachelor of science in agribusiness':                        'BSAgribus',
    'bachelor of science in forestry':                            'BSF',
    'bachelor of science in fisheries':                           'BSFisheries',
    'bachelor of science in veterinary medicine':                 'BSVM',
    'bachelor of science in environmental science':               'BSES',

    // Education
    'bachelor of secondary education':                            'BSEd',
    'bachelor of elementary education':                           'BEEd',
    'bachelor of physical education':                             'BPEd',
    'bachelor of early childhood education':                      'BECED',
    'bachelor of special needs education':                        'BSNED',
    'bachelor of technical-vocational teacher education':         'BTVTED',
    'bachelor of culture and arts education':                     'BCAED',

    // Architecture & Design
    'bachelor of science in architecture':                        'BSArch',
    'bachelor of landscape architecture':                         'BLA',
    'bachelor of interior design':                                'BID',
    'bachelor of fine arts':                                      'BFA',
    'bachelor of graphic technology':                             'BGT',

    // Arts & Social Sciences
    'bachelor of arts in communication':                          'BAComm',
    'bachelor of arts in english':                                'BAEng',
    'bachelor of arts in political science':                      'BAPol',
    'bachelor of arts in sociology':                              'BASoc',
    'bachelor of arts in philosophy':                             'BAPhil',
    'bachelor of arts in history':                                'BAHist',
    'bachelor of arts in economics':                              'BAEcon',
    'bachelor of arts in anthropology':                           'BAAnthro',
    'bachelor of arts in linguistics':                            'BALing',
    'bachelor of arts in literature':                             'BALit',
    'bachelor of arts in journalism':                             'BAJ',
    'bachelor of arts in broadcasting':                           'BAB',
    'bachelor of arts in film':                                   'BAFilm',
    'bachelor of science in social work':                         'BSSW',
    'bachelor of science in criminology':                         'BSCrim',
    'bachelor of science in foreign service':                     'BSFS',

    // Hospitality & Tourism
    'bachelor of science in tourism management':                  'BSTM',
    'bachelor of science in hospitality management':              'BSHM',
    'bachelor of science in hotel and restaurant management':     'BSHRM',
    'bachelor of science in travel management':                   'BSTRM',

    // Law & Governance
    'bachelor of laws':                                           'LLB',
    'juris doctor':                                               'JD',
    'bachelor of science in legal management':                    'BSLM',

    // Technology & Vocational
    'bachelor of technology':                                     'BTech',
    'bachelor of science in industrial technology':               'BSIT',
    'diploma in information technology':                          'DIT',

    // Music & Performing Arts
    'bachelor of music':                                          'BMus',
    'bachelor of arts in music':                                  'BAMusic',
    'bachelor of performing arts':                                'BPA',
  };

  constructor(
    private appwrite: AppwriteService,
    private router  : Router
  ) {}

  async ngOnInit() {
    await this.loadStudents();
  }

  async loadStudents() {
    this.loading = true;
    try {
      const { Query } = await import('appwrite');

      let allStudents: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const res = await this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.STUDENTS_COL,
          [Query.limit(this.APPWRITE_PAGE_SIZE), Query.offset(offset)]
        );
        allStudents = [...allStudents, ...res.documents];
        hasMore = res.documents.length === this.APPWRITE_PAGE_SIZE;
        offset += this.APPWRITE_PAGE_SIZE;
      }

      const [archiveRes, evalRes] = await Promise.all([
        this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.ARCHIVES_COL,
          [Query.limit(500)]
        ),
        this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.EVALUATIONS_COL,
          [Query.limit(500)]
        )
      ]);

      const archivedIds = new Set(
        archiveRes.documents.map((d: any) => d.student_doc_id)
      );

      this.evaluatedStudentIds = new Set(
        evalRes.documents.map((e: any) => e.student_id_ref)
      );

      const active = allStudents.filter(s => !archivedIds.has(s.$id));

      // Sort by OJT start date descending (latest first)
      active.sort((a, b) => {
        const dateA = new Date(a.ojt_start || a.$createdAt).getTime();
        const dateB = new Date(b.ojt_start || b.$createdAt).getTime();
        return dateB - dateA;
      });

      this.students         = active;
      this.filteredStudents = [...this.students];

    } catch (error: any) {
      console.error('Failed to load students:', error.message);
    } finally {
      this.loading = false;
    }
  }

  // PAGINATION
  get pagedStudents(): Student[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredStudents.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredStudents.length / this.pageSize) || 1;
  }

  // Ghost rows to fill empty slots and keep table height fixed
  get ghostRows(): null[] {
    const filled = this.pagedStudents.length;
    const empty  = this.pageSize - filled;
    return empty > 0 ? Array(empty).fill(null) : [];
  }

  get rangeStart(): number {
    if (this.filteredStudents.length === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredStudents.length);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  prevPage() { this.goToPage(this.currentPage - 1); }
  nextPage() { this.goToPage(this.currentPage + 1); }

  onToggleSidebar(collapsed: boolean) {
    this.isCollapsed = collapsed;
  }

  openProfile(student: Student) {
    this.router.navigate(['/admin-ojt-profile', student.$id]);
  }

  onSearch(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.currentPage = 1;
    this.filteredStudents = this.students.filter(s => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      return fullName.includes(this.searchQuery) ||
             s.student_id.toLowerCase().includes(this.searchQuery) ||
             s.course.toLowerCase().includes(this.searchQuery) ||
             s.email.toLowerCase().includes(this.searchQuery);
    });
  }

  abbreviateCourse(course: string): string {
    if (!course) return '—';
    const key = course.trim().toLowerCase();

    // 1. Direct map lookup
    if (this.COURSE_MAP[key]) return this.COURSE_MAP[key];

    // 2. Fuzzy fallback: extract uppercase letters & digits from each word
    //    e.g. "BS Marine Engineering" → "BSMarE" won't be in map,
    //    so we try to auto-abbreviate from the words themselves
    const words = course.trim().split(/\s+/);
    const skip  = new Set(['of', 'in', 'and', 'the', 'a', 'an', 'for', '&']);
    const abbr  = words
      .filter(w => !skip.has(w.toLowerCase()))
      .map(w => w.charAt(0).toUpperCase() + (w.length > 3 ? w.charAt(1).toLowerCase() : ''))
      .join('');

    return abbr || course;
  }

  getFullName(s: Student): string {
    return `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`;
  }

  getPhotoUrl(photoId: string): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${photoId}/view?project=${this.PROJECT_ID}`;
  }

  getProgress(s: Student): number {
    const completed = s.completed_hours || 0;
    const required  = s.required_hours  || 500;
    return Math.min(parseFloat(((completed / required) * 100).toFixed(1)), 100);
  }

  getStartDate(student: Student): string {
    const raw = student.ojt_start || student.$createdAt;
    return new Date(raw).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  getAvatarUrl(student: Student): string {
    if (student.profile_photo_id) {
      return this.getPhotoUrl(student.profile_photo_id);
    }
    const initials = `${student.first_name.charAt(0)} ${student.last_name.charAt(0)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2563eb&color=fff&size=64`;
  }

  async archiveStudent(event: MouseEvent, student: Student) {
    event.stopPropagation();

    const required  = student.required_hours  || 500;
    const completed = student.completed_hours || 0;

    const missing: string[] = [];
    if (completed < required)
      missing.push(`<li>❌ Hours not completed <b>(${completed}/${required} hrs)</b></li>`);
    if (!student.cert_sent)
      missing.push('<li>❌ Certificate not yet sent</li>');
    if (!this.evaluatedStudentIds.has(student.$id))
      missing.push('<li>❌ No evaluation submitted</li>');

    if (missing.length > 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Cannot Archive Yet',
        html: `
          <p style="font-size:13px;color:#6b7280;margin-bottom:10px;">
            <b>${this.getFullName(student)}</b> is missing the following requirements:
          </p>
          <ul style="text-align:left;font-size:13px;color:#374151;line-height:2;">
            ${missing.join('')}
          </ul>
        `,
        confirmButtonText: 'OK',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    const result = await Swal.fire({
      icon: 'question',
      title: 'Archive Intern?',
      html: `
        <p style="font-size:13px;color:#6b7280;">
          Are you sure you want to archive <b>${this.getFullName(student)}</b>?
        </p>
        <div style="margin-top:12px;padding:12px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#374151;text-align:left;line-height:1.8;">
          <div>✅ Hours completed (${completed}/${required} hrs)</div>
          <div>✅ Certificate sent</div>
          <div>✅ Evaluation submitted</div>
        </div>
        <p style="font-size:12px;color:#9ca3af;margin-top:10px;">
          This will move them to <b>Completed OJT</b>.
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fa-solid fa-box-archive"></i> Archive',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#e5e7eb',
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    this.archivingId = student.$id;
    try {
      await this.appwrite.checkAndArchiveStudent(student.$id);
      this.students         = this.students.filter(s => s.$id !== student.$id);
      this.filteredStudents = this.filteredStudents.filter(s => s.$id !== student.$id);

      await Swal.fire({
        icon: 'success',
        title: 'Archived!',
        text: `${this.getFullName(student)} has been moved to Completed OJT.`,
        confirmButtonColor: '#2563eb',
        timer: 2500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
        timerProgressBar: true
      });

    } catch (e: any) {
      await Swal.fire({
        icon: 'error',
        title: 'Archive Failed',
        text: e.message,
        confirmButtonColor: '#2563eb'
      });
    } finally {
      this.archivingId = null;
    }
  }

  canArchive(student: Student): boolean {
    const completed = student.completed_hours || 0;
    const required  = student.required_hours  || 500;
    return completed >= required
      && !!student.cert_sent
      && this.evaluatedStudentIds.has(student.$id);
  }

  getArchiveTooltip(student: Student): string {
    const completed = student.completed_hours || 0;
    const required  = student.required_hours  || 500;
    const missing: string[] = [];

    if (completed < required)
      missing.push(`❌ Hours not completed (${completed}/${required} hrs)`);
    if (!student.cert_sent)
      missing.push('❌ Certificate not yet sent');
    if (!this.evaluatedStudentIds.has(student.$id))
      missing.push('❌ No evaluation submitted');

    if (missing.length === 0)
      return '✅ All requirements met — click to archive';

    return 'Cannot archive yet:\n' + missing.join('\n');
  }
}