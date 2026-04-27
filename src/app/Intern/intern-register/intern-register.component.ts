import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { ID } from 'appwrite';

interface CourseOption {
  abbr: string;
  full: string;
}

const COURSE_LIST: CourseOption[] = [
  // Information Technology & Computing
  { abbr: 'BSIT',     full: 'Bachelor of Science in Information Technology' },
  { abbr: 'BSCS',     full: 'Bachelor of Science in Computer Science' },
  { abbr: 'BSCE',     full: 'Bachelor of Science in Computer Engineering' },
  { abbr: 'BSIS',     full: 'Bachelor of Science in Information Systems' },
  { abbr: 'BSDA',     full: 'Bachelor of Science in Data Analytics' },
  { abbr: 'BSAI',     full: 'Bachelor of Science in Artificial Intelligence' },
  { abbr: 'BSCPE',    full: 'Bachelor of Science in Computer Engineering' },
  { abbr: 'BSEMC',    full: 'Bachelor of Science in Entertainment and Multimedia Computing' },
  // Engineering
  { abbr: 'BSEE',     full: 'Bachelor of Science in Electrical Engineering' },
  { abbr: 'BSECE',    full: 'Bachelor of Science in Electronics and Communications Engineering' },
  { abbr: 'BSME',     full: 'Bachelor of Science in Mechanical Engineering' },
  { abbr: 'BSCIVIL',  full: 'Bachelor of Science in Civil Engineering' },
  { abbr: 'BSIE',     full: 'Bachelor of Science in Industrial Engineering' },
  { abbr: 'BSAE',     full: 'Bachelor of Science in Aeronautical Engineering' },
  { abbr: 'BSCHE',    full: 'Bachelor of Science in Chemical Engineering' },
  { abbr: 'BSGE',     full: 'Bachelor of Science in Geodetic Engineering' },
  { abbr: 'BSME',     full: 'Bachelor of Science in Mining Engineering' },
  // Business & Management
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
  // Education
  { abbr: 'BEED',     full: 'Bachelor of Elementary Education' },
  { abbr: 'BSED',     full: 'Bachelor of Secondary Education' },
  { abbr: 'BSED-ENG', full: 'Bachelor of Secondary Education major in English' },
  { abbr: 'BSED-MATH',full: 'Bachelor of Secondary Education major in Mathematics' },
  { abbr: 'BSED-SCI', full: 'Bachelor of Secondary Education major in Science' },
  { abbr: 'BSED-FIL', full: 'Bachelor of Secondary Education major in Filipino' },
  { abbr: 'BSED-SS',  full: 'Bachelor of Secondary Education major in Social Studies' },
  { abbr: 'BPED',     full: 'Bachelor of Physical Education' },
  { abbr: 'BSPE',     full: 'Bachelor of Science in Physical Education' },
  // Health & Medicine
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
  // Science & Mathematics
  { abbr: 'BSMATH',   full: 'Bachelor of Science in Mathematics' },
  { abbr: 'BSSTAT',   full: 'Bachelor of Science in Statistics' },
  { abbr: 'BSBIO',    full: 'Bachelor of Science in Biology' },
  { abbr: 'BSCHEM',   full: 'Bachelor of Science in Chemistry' },
  { abbr: 'BSPHYSICS',full: 'Bachelor of Science in Physics' },
  { abbr: 'BSENVSCI', full: 'Bachelor of Science in Environmental Science' },
  { abbr: 'BSAPMATH', full: 'Bachelor of Science in Applied Mathematics' },
  // Arts & Humanities
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
  // Design & Architecture
  { abbr: 'BSARCH',   full: 'Bachelor of Science in Architecture' },
  { abbr: 'BSID',     full: 'Bachelor of Science in Industrial Design' },
  { abbr: 'BSFA',     full: 'Bachelor of Science in Fine Arts' },
  { abbr: 'BSGD',     full: 'Bachelor of Science in Graphic Design' },
  { abbr: 'BSINTDES', full: 'Bachelor of Science in Interior Design' },
  // Agriculture & Environment
  { abbr: 'BSAGRI',   full: 'Bachelor of Science in Agriculture' },
  { abbr: 'BSFOR',    full: 'Bachelor of Science in Forestry' },
  { abbr: 'BSFISHERY',full: 'Bachelor of Science in Fisheries' },
  { abbr: 'BSAGRIBIZ',full: 'Bachelor of Science in Agribusiness' },
  // Law & Criminology
  { abbr: 'ABLAW',    full: 'Bachelor of Laws (Juris Doctor)' },
  { abbr: 'BSCRIM',   full: 'Bachelor of Science in Criminology' },
  // Mass Communication & Journalism
  { abbr: 'BSMC',     full: 'Bachelor of Science in Mass Communication' },
  { abbr: 'BSJOURNALISM', full: 'Bachelor of Science in Journalism' },
  { abbr: 'BSADVCOMM',full: 'Bachelor of Science in Advertising Communication' },
  // Hospitality & Culinary
  { abbr: 'BSCUL',    full: 'Bachelor of Science in Culinary Arts' },
  { abbr: 'BSHOSP',   full: 'Bachelor of Science in Hospitality Management' },
];

@Component({
  selector: 'app-intern-register',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './intern-register.component.html',
  styleUrls: ['./intern-register.component.css']
})
export class InternRegisterComponent {

  // Account fields
  email        = '';
  password     = '';
  showPassword = false;

  // Personal info
  firstName     = '';
  middleName    = '';
  lastName      = '';
  contactNumber = '';
  birthday      = '';
  gender        = '';
  homeAddress   = '';

  // Academic
  studentId  = '';
  schoolName = '';
  course     = '';
  yearLevel  = '';

  // Course autocomplete
  courseSearch         = '';
  filteredCourses      : CourseOption[] = [];
  showCourseDropdown   = false;
  courseHighlightIndex = -1;
  private courseSelected = false;

  // File uploads
  resumeFile      : File | null = null;
  endorsementFile : File | null = null;
  coeFile         : File | null = null;

  resumeFileName      = '';
  endorsementFileName = '';
  coeFileName         = '';

  // UI state
  loading        = false;
  errorMessage   = '';
  successMessage = '';

  // Field-level validation errors
  fieldErrors: Record<string, string> = {};

  // Track which fields have been touched
  touched: Record<string, boolean> = {};

  readonly BUCKET_ID = '69baaf64002ceb2490df';

  constructor(private appwrite: AppwriteService) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  // ── COURSE AUTOCOMPLETE ───────────────────────────────────

  onCourseInput() {
    this.courseSelected = false;
    this.course         = '';
    const q = this.courseSearch.trim().toLowerCase();

    if (!q) {
      this.filteredCourses    = [];
      this.showCourseDropdown = false;
      return;
    }

    this.filteredCourses = COURSE_LIST.filter(c =>
      c.abbr.toLowerCase().includes(q) ||
      c.full.toLowerCase().includes(q)
    ).slice(0, 8);

    this.courseHighlightIndex = -1;
    this.showCourseDropdown   = true;
  }

  onCourseFocus() {
    if (this.courseSearch.trim()) {
      this.showCourseDropdown = this.filteredCourses.length > 0;
    }
  }

  onCourseBlur() {
    setTimeout(() => {
      this.showCourseDropdown = false;

      if (!this.courseSelected && this.courseSearch.trim()) {
        this.course = this.courseSearch.trim();
      }

      this.touched['course'] = true;
      this.validateField('course');
    }, 180);
  }

  onCourseKeydown(event: KeyboardEvent) {
    if (!this.showCourseDropdown || !this.filteredCourses.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.courseHighlightIndex = Math.min(
        this.courseHighlightIndex + 1, this.filteredCourses.length - 1
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.courseHighlightIndex = Math.max(this.courseHighlightIndex - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.courseHighlightIndex >= 0) {
        this.selectCourse(this.filteredCourses[this.courseHighlightIndex]);
      }
    } else if (event.key === 'Escape') {
      this.showCourseDropdown = false;
    }
  }

  selectCourse(c: CourseOption) {
    this.course             = c.full;   // ← full name saved to DB
    this.courseSearch       = c.abbr;   // ← abbreviation shown in input field
    this.courseSelected     = true;
    this.showCourseDropdown = false;
    this.courseHighlightIndex = -1;

    delete this.fieldErrors['course'];
  }

  // ── FILE CHANGE ───────────────────────────────────────────

  onFileChange(event: Event, type: 'resume' | 'endorsement' | 'coe') {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    const maxSize = 5 * 1024 * 1024;

    if (file && file.size > maxSize) {
      this.fieldErrors[type] = 'File must be under 5MB.';
      return;
    }

    delete this.fieldErrors[type];

    if (type === 'resume') {
      this.resumeFile     = file;
      this.resumeFileName = file?.name ?? '';
    } else if (type === 'endorsement') {
      this.endorsementFile     = file;
      this.endorsementFileName = file?.name ?? '';
    } else {
      this.coeFile     = file;
      this.coeFileName = file?.name ?? '';
    }
  }

  // ── FIELD VALIDATORS ─────────────────────────────────────

  private validateEmail(value: string): string {
    if (!value.trim()) return 'Email is required.';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(value)) return 'Enter a valid email address.';
    return '';
  }

  private validatePassword(value: string): string {
    if (!value) return 'Password is required.';
    if (value.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(value)) return 'Include at least one uppercase letter.';
    if (!/[0-9]/.test(value)) return 'Include at least one number.';
    if (!/[^A-Za-z0-9]/.test(value)) return 'Include at least one special character.';
    return '';
  }

  private validateContactNumber(value: string): string {
    if (!value.trim()) return 'Contact number is required.';
    const re = /^(\+639|09)\d{9}$/;
    if (!re.test(value.replace(/\s/g, '')))
      return 'Enter a valid PH number (e.g. 09XXXXXXXXX or +639XXXXXXXXX).';
    return '';
  }

  private validateBirthday(value: string): string {
    if (!value) return 'Birthday is required.';
    const dob   = new Date(value);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    if (age < 13)  return 'You must be at least 13 years old to register.';
    if (age > 100) return 'Please enter a valid birthday.';
    return '';
  }

  private validateRequired(value: string, label: string): string {
    return value.trim() ? '' : `${label} is required.`;
  }

  onBlur(field: string) {
    this.touched[field] = true;
    this.validateField(field);
  }

  private validateField(field: string) {
    let error = '';
    switch (field) {
      case 'email':         error = this.validateEmail(this.email); break;
      case 'password':      error = this.validatePassword(this.password); break;
      case 'firstName':     error = this.validateRequired(this.firstName, 'First name'); break;
      case 'lastName':      error = this.validateRequired(this.lastName, 'Last name'); break;
      case 'contactNumber': error = this.validateContactNumber(this.contactNumber); break;
      case 'birthday':      error = this.validateBirthday(this.birthday); break;
      case 'gender':        error = this.validateRequired(this.gender, 'Gender'); break;
      case 'homeAddress':   error = this.validateRequired(this.homeAddress, 'Home address'); break;
      case 'studentId':     error = this.validateRequired(this.studentId, 'Student ID'); break;
      case 'schoolName':    error = this.validateRequired(this.schoolName, 'School name'); break;
      case 'course':        error = this.validateRequired(this.course, 'Course'); break;
      case 'yearLevel':     error = this.validateRequired(this.yearLevel, 'Year level'); break;
    }
    if (error) this.fieldErrors[field] = error;
    else        delete this.fieldErrors[field];
  }

  private validateAll(): boolean {
    const fields = [
      'email', 'password', 'firstName', 'lastName',
      'contactNumber', 'birthday', 'gender', 'homeAddress',
      'studentId', 'schoolName', 'course', 'yearLevel'
    ];
    fields.forEach(f => { this.touched[f] = true; this.validateField(f); });

    if (!this.resumeFile)      this.fieldErrors['resume']      = 'Resume / CV is required.';
    if (!this.endorsementFile) this.fieldErrors['endorsement'] = 'Endorsement letter is required.';
    if (!this.coeFile)         this.fieldErrors['coe']         = 'Certificate of enrollment is required.';

    return Object.keys(this.fieldErrors).length === 0;
  }

  // ── REGISTER ─────────────────────────────────────────────

  async onRegister() {
  this.errorMessage = '';

  if (!this.course && this.courseSearch.trim()) {
    this.course = this.courseSearch.trim();
  }

  if (!this.validateAll()) {
    this.errorMessage = 'Please fix the errors below before submitting.';
    return;
  }

  this.successMessage = '';
  this.loading        = true;

  try {
    // ── Duplicate checks ──────────────────────────────────
  const { Query } = await import('appwrite');

const [
  phoneCheckApplicants,
  idCheckApplicants,
  phoneCheckStudents,
  idCheckStudents,
  emailCheckStudents
] = await Promise.all([
  this.appwrite.databases.listDocuments(
    this.appwrite.DATABASE_ID,
    this.appwrite.APPLICANTS_COL,
    [Query.equal('contact_number', this.contactNumber.replace(/\s/g, '')), Query.limit(1)]
  ),
  this.appwrite.databases.listDocuments(
    this.appwrite.DATABASE_ID,
    this.appwrite.APPLICANTS_COL,
    [Query.equal('student_id', this.studentId.trim()), Query.limit(1)]
  ),
  this.appwrite.databases.listDocuments(
    this.appwrite.DATABASE_ID,
    this.appwrite.STUDENTS_COL,
    [Query.equal('contact_number', this.contactNumber.replace(/\s/g, '')), Query.limit(1)]
  ),
  this.appwrite.databases.listDocuments(
    this.appwrite.DATABASE_ID,
    this.appwrite.STUDENTS_COL,
    [Query.equal('student_id', this.studentId.trim()), Query.limit(1)]
  ),
  this.appwrite.databases.listDocuments(
    this.appwrite.DATABASE_ID,
    this.appwrite.STUDENTS_COL,
    [Query.equal('email', this.email.trim()), Query.limit(1)]
  )
]);

const duplicateErrors: string[] = [];

if (phoneCheckApplicants.total > 0 || phoneCheckStudents.total > 0)
  duplicateErrors.push('contact number');

if (idCheckApplicants.total > 0 || idCheckStudents.total > 0)
  duplicateErrors.push('Student ID');

if (emailCheckStudents.total > 0)
  duplicateErrors.push('email');

if (duplicateErrors.length > 0) {
  this.errorMessage = `The following are already registered: ${duplicateErrors.join(', ')}.`;
  this.loading = false;
  return;
}
    // ── End duplicate checks ──────────────────────────────

    const user = await this.appwrite.account.create(
      ID.unique(),
      this.email,
      this.password,
      `${this.firstName} ${this.lastName}`
    );

    let resumeFileId      = '';
    let endorsementFileId = '';
    let coeFileId         = '';

    if (this.resumeFile) {
      const res = await this.appwrite.storage.createFile(
        this.BUCKET_ID, ID.unique(), this.resumeFile
      );
      resumeFileId = res.$id;
    }

    if (this.endorsementFile) {
      const res = await this.appwrite.storage.createFile(
        this.BUCKET_ID, ID.unique(), this.endorsementFile
      );
      endorsementFileId = res.$id;
    }

    if (this.coeFile) {
      const res = await this.appwrite.storage.createFile(
        this.BUCKET_ID, ID.unique(), this.coeFile
      );
      coeFileId = res.$id;
    }

    await this.appwrite.databases.createDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.APPLICANTS_COL,
      user.$id,
      {
        auth_user_id:        user.$id,
        first_name:          this.firstName,
        middle_name:         this.middleName,
        last_name:           this.lastName,
        email:               this.email,
        contact_number:      this.contactNumber,
        birthday:            this.birthday,
        gender:              this.gender,
        home_address:        this.homeAddress,
        student_id:          this.studentId,
        school_name:         this.schoolName,
        course:              this.course,
        year_level:          this.yearLevel,
        resume_file_id:      resumeFileId,
        endorsement_file_id: endorsementFileId,
        coe_file_id:         coeFileId,
        status:              'pending'
      }
    );

    try { await this.appwrite.account.deleteSession('current'); } catch { }

    this.successMessage = 'pending';

  } catch (error: any) {
    if (error?.message?.toLowerCase().includes('already exists') || error?.code === 409) {
      this.errorMessage = 'An account with this email already exists. Please log in instead.';
    } else {
      this.errorMessage = error.message ?? 'Registration failed. Please try again.';
    }
  } finally {
    this.loading = false;
  }
}
}