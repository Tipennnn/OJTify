import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';
import { Query } from 'appwrite';

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
  ojt_start?: string;
  $createdAt: string;
}

@Component({
  selector: 'app-supervisor-ojt',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SupervisorSidenavComponent,
    SupervisorTopnavComponent
  ],
  templateUrl: './supervisor-ojt.component.html',
  styleUrl: './supervisor-ojt.component.css'
})
export class SupervisorOjtComponent implements OnInit {

  students            : Student[] = [];
  filteredStudents    : Student[] = [];
  loading             = false;
  searchQuery         = '';
  isCollapsed         = false;
  currentSupervisorId = '';
  evaluationMap: { [studentId: string]: boolean } = {};

  // PAGINATION
  currentPage = 1;
  pageSize    = 10;
  totalPages  = 1;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

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
    'bachelor of science in petroleum engineering':               'BSPetE',
    'bachelor of science in sanitary engineering':                'BSSanE',
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
    'bachelor of science in respiratory therapy':                 'BSRESPTH',
    'bachelor of science in nutrition and dietetics':             'BSND',
    'bachelor of science in midwifery':                           'BSMid',
    'bachelor of science in dentistry':                           'BSD',
    'doctor of medicine':                                         'MD',
    'doctor of dental medicine':                                  'DMD',
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
    'bachelor of secondary education':                            'BSEd',
    'bachelor of elementary education':                           'BEEd',
    'bachelor of physical education':                             'BPEd',
    'bachelor of early childhood education':                      'BECED',
    'bachelor of special needs education':                        'BSNED',
    'bachelor of technical-vocational teacher education':         'BTVTED',
    'bachelor of culture and arts education':                     'BCAED',
    'bachelor of science in architecture':                        'BSArch',
    'bachelor of landscape architecture':                         'BLA',
    'bachelor of interior design':                                'BID',
    'bachelor of fine arts':                                      'BFA',
    'bachelor of graphic technology':                             'BGT',
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
    'bachelor of science in tourism management':                  'BSTM',
    'bachelor of science in hospitality management':              'BSHM',
    'bachelor of science in hotel and restaurant management':     'BSHRM',
    'bachelor of science in travel management':                   'BSTRM',
    'bachelor of laws':                                           'LLB',
    'juris doctor':                                               'JD',
    'bachelor of science in legal management':                    'BSLM',
    'bachelor of technology':                                     'BTech',
    'bachelor of science in industrial technology':               'BSIT',
    'diploma in information technology':                          'DIT',
    'bachelor of music':                                          'BMus',
    'bachelor of arts in music':                                  'BAMusic',
    'bachelor of performing arts':                                'BPA',
  };

  constructor(
    private appwrite: AppwriteService,
    private router  : Router
  ) {}

  async ngOnInit() {
    await this.getCurrentSupervisor();
    await this.loadStudents();
    await this.loadEvaluations();

  }

  async getCurrentSupervisor() {
    try {
      const user = await this.appwrite.account.get();
      this.currentSupervisorId = user.$id;
    } catch (error: any) {
      console.error('Failed to get supervisor:', error.message);
    }
  }

async loadStudents() {
  this.loading = true;
  try {
    let allStudents: any[] = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        [Query.limit(pageSize), Query.offset(offset)]
      );
      allStudents = allStudents.concat(res.documents);
      if (res.documents.length < pageSize) break;
      offset += pageSize;
    }

    const filtered = allStudents.filter(s =>
      s.supervisor_id === this.currentSupervisorId
    );

    filtered.sort((a, b) => {
      const dateA = new Date(a.ojt_start || a.$createdAt).getTime();
      const dateB = new Date(b.ojt_start || b.$createdAt).getTime();
      return dateB - dateA;
    });

    this.students         = filtered;
    this.filteredStudents = [...this.students];
    this.updatePagination();
  } catch (error: any) {
    console.error('Failed to load students:', error.message);
  } finally {
    this.loading = false;
  }
}

  updatePagination() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredStudents.length / this.pageSize));
  }

  // PAGINATION
  get pagedStudents(): Student[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredStudents.slice(start, start + this.pageSize);
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

  get visiblePageNumbers(): number[] {
    return this.buildVisiblePages(this.currentPage, this.totalPages);
  }

  private buildVisiblePages(cur: number, total: number): number[] {
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

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  prevPage() { this.goToPage(this.currentPage - 1); }
  nextPage() { this.goToPage(this.currentPage + 1); }

  onSearch(event: any) {
    this.searchQuery  = event.target.value.toLowerCase();
    this.currentPage  = 1;
    this.filteredStudents = this.students.filter(s => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      return fullName.includes(this.searchQuery)                    ||
             s.student_id.toLowerCase().includes(this.searchQuery)  ||
             s.course.toLowerCase().includes(this.searchQuery)      ||
             s.email.toLowerCase().includes(this.searchQuery);
    });
    this.updatePagination();
  }

  onToggleSidebar(collapsed: boolean) {
    this.isCollapsed = collapsed;
  }

  openProfile(student: Student) {
    this.router.navigate(['/supervisor-ojt-profile', student.$id]);
  }

  abbreviateCourse(course: string): string {
    if (!course) return '—';
    const key = course.trim().toLowerCase();
    if (this.COURSE_MAP[key]) return this.COURSE_MAP[key];
    const words = course.trim().split(/\s+/);
    const skip  = new Set(['of', 'in', 'and', 'the', 'a', 'an', 'for', '&']);
    const abbr  = words
      .filter(w => !skip.has(w.toLowerCase()))
      .map(w => w.charAt(0).toUpperCase() + (w.length > 3 ? w.charAt(1).toLowerCase() : ''))
      .join('');
    return abbr || course;
  }

  getFullName(s: Student): string {
    return `${s.first_name}${s.middle_name ? ' ' + s.middle_name : ''} ${s.last_name}`;
  }

  getPhotoUrl(photoId: string): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${photoId}/view?project=${this.PROJECT_ID}`;
  }

  getAvatarUrl(student: Student): string {
    if (student.profile_photo_id) {
      return this.getPhotoUrl(student.profile_photo_id);
    }
    const initials = `${student.first_name.charAt(0)} ${student.last_name.charAt(0)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0818A8&color=fff&size=64`;
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
  async loadEvaluations() {
  try {
    let allEvals: any[] = [];
    let offset = 0;
    while (true) {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        'evaluations',
        [Query.limit(100), Query.offset(offset)]
      );
      allEvals = allEvals.concat(res.documents);
      if (res.documents.length < 100) break;
      offset += 100;
    }
    this.evaluationMap = {};
    allEvals
      .filter(e => e.supervisor_id === this.currentSupervisorId)
      .forEach(e => {
        this.evaluationMap[e.student_id_ref] = true;  // ← fixed field name
      });
  } catch (error: any) {
    console.error('Failed to load evaluations:', error.message);
  }
}

isCompleted(student: Student): boolean {
  const completed = student.completed_hours || 0;
  const required  = student.required_hours  || 500;
  return completed >= required;
}

getEvalTooltip(student: Student): string {
  if (!this.isCompleted(student)) return '';
  return this.evaluationMap[student.$id]
    ? '✓ Evaluated'
    : '⚠ Not yet evaluated';
}
}