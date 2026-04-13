import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../services/appwrite.service';
import { Query } from 'appwrite';
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
  contact_number?: string;
  birthday?: string;
  gender?: string;
  home_address?: string;
  year_level?: string;
  profile_photo_id?: string;
  resume_file_id?: string;
  endorsement_file_id?: string;
  coe_file_id?: string;
  required_hours?: number;
  completed_hours?: number;
  supervisor_id?: string;
  $createdAt: string;
}

@Component({
  selector: 'app-admin-ojt-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-ojt-profile.component.html',
  styleUrl: './admin-ojt-profile.component.css'
})
export class AdminOjtProfileComponent implements OnInit {

  student     : Student | null = null;
  supervisors    : any[] = [];
  loading     = false;
  saveLoading = false;
  editMode    = false;

  // Editable fields
  editFirstName     = '';
  editMiddleName    = '';
  editLastName      = '';
  editContactNumber = '';
  editBirthday      = '';
  editGender        = '';
  editHomeAddress   = '';
  editStudentId     = '';
  editSchoolName    = '';
  editCourse        = '';
  editYearLevel     = '';
  editRequiredHours  = 500;
  editCompletedHours = 0;
  editSupervisorId = '';

  Math = Math;
  parseFloat = parseFloat;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(
    private appwrite: AppwriteService,
    private route   : ActivatedRoute,
    private router  : Router
  ) {}

  async ngOnInit() {
  const id = this.route.snapshot.paramMap.get('id');
  if (id) await this.loadStudent(id);
  await this.loadSupervisors();  // ← add this
}

  async loadStudent(id: string) {
    this.loading = true;
    try {
      const doc = await this.appwrite.databases.getDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        id
      );
      this.student = doc as any;
      this.populateEditFields();
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Not found', text: error.message });
    } finally {
      this.loading = false;
    }
  }

  populateEditFields() {
    if (!this.student) return;
    this.editFirstName      = this.student.first_name      || '';
    this.editMiddleName     = this.student.middle_name     || '';
    this.editLastName       = this.student.last_name       || '';
    this.editContactNumber  = this.student.contact_number  || '';
    this.editBirthday       = this.student.birthday        || '';
    this.editGender         = this.student.gender          || '';
    this.editHomeAddress    = this.student.home_address    || '';
    this.editStudentId      = this.student.student_id      || '';
    this.editSchoolName     = this.student.school_name     || '';
    this.editCourse         = this.student.course          || '';
    this.editYearLevel      = this.student.year_level      || '';
    this.editRequiredHours  = this.student.required_hours  || 500;
    this.editCompletedHours = this.student.completed_hours || 0;
    this.editSupervisorId = (this.student as any).supervisor_id || '';
  }

  toggleEdit() {
    this.editMode = !this.editMode;
    if (this.editMode) {
      this.populateEditFields();
    }
  }

  async saveAll() {
  if (!this.student) return;

  if (this.editCompletedHours > this.editRequiredHours) {
    Swal.fire({
      icon: 'warning',
      title: 'Invalid Hours',
      text: 'Completed hours cannot exceed required hours.'
    });
    return;
  }

  this.saveLoading = true;
  try {
    const willComplete = this.editCompletedHours >= this.editRequiredHours;

    if (willComplete) {
      // 1. Get OJT start date from first attendance record
      // ✅ FIXED - using Query helper
  const attendance = await this.appwrite.databases.listDocuments(
  this.appwrite.DATABASE_ID,
  this.appwrite.ATTENDANCE_COL,
  [
    Query.equal('student_id', this.student.student_id),
    Query.orderAsc('date'),
    Query.limit(1)
  ]
);
      const firstAttendance = attendance.documents[0];
      const ojtStart = firstAttendance
        ? firstAttendance['date']
        : this.student.$createdAt.split('T')[0];

      const ojtEnd = new Date().toISOString().split('T')[0];

      // 2. Copy student to archives collection
      await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.ARCHIVES_COL,
        'unique()',
        {
          student_doc_id:       this.student.$id,
          first_name:           this.editFirstName,
          middle_name:          this.editMiddleName,
          last_name:            this.editLastName,
          email:                this.student.email,
          contact_number:       this.editContactNumber,
          birthday:             this.editBirthday,
          gender:               this.editGender,
          home_address:         this.editHomeAddress,
          student_id:           this.editStudentId,
          school_name:          this.editSchoolName,
          course:               this.editCourse,
          year_level:           this.editYearLevel,
          profile_photo_id:     this.student.profile_photo_id     || null,
          resume_file_id:       this.student.resume_file_id       || null,
          endorsement_file_id:  this.student.endorsement_file_id  || null,
          coe_file_id:          this.student.coe_file_id          || null,
          required_hours:       this.editRequiredHours,
          completed_hours:      this.editCompletedHours,
          ojt_start:            ojtStart,
          ojt_end:              ojtEnd,
          archived_at:          new Date().toISOString()
        }
      );

      // 3. Delete student from students collection
      await this.appwrite.databases.deleteDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL,
        this.student.$id
      );

      Swal.fire({
        icon: 'success',
        title: 'OJT Completed!',
        text: `${this.editFirstName} ${this.editLastName} has been archived.`,
        confirmButtonColor: '#2563eb'
      }).then(() => {
        this.router.navigate(['/admin-ojt']);
      });

    } else {
      // Not yet complete — just update normally
     await this.appwrite.databases.updateDocument(
  this.appwrite.DATABASE_ID,
  this.appwrite.STUDENTS_COL,
  this.student.$id,
  {
    first_name:      this.editFirstName,
    middle_name:     this.editMiddleName,
    last_name:       this.editLastName,
    contact_number:  this.editContactNumber,
    birthday:        this.editBirthday,
    gender:          this.editGender,
    home_address:    this.editHomeAddress,
    student_id:      this.editStudentId,
    school_name:     this.editSchoolName,
    course:          this.editCourse,
    year_level:      this.editYearLevel,
    required_hours:  this.editRequiredHours,
    completed_hours: this.editCompletedHours,
    supervisor_id:   this.editSupervisorId || null  // ← add this
  }
);
// ✅ Update assigned_students count on the supervisor
if (this.editSupervisorId) {
  try {
    // Count how many students have this supervisor
    const { Query } = await import('appwrite');
    const countRes = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.STUDENTS_COL,
      [Query.equal('supervisor_id', this.editSupervisorId)]
    );
    await this.appwrite.databases.updateDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.SUPERVISORS_COL,
      this.editSupervisorId,
      { assigned_students: countRes.total }
    );
  } catch (e) {
    console.error('Failed to update supervisor student count:', e);
  }
}

      // Update local object
      this.student.first_name      = this.editFirstName;
      this.student.middle_name     = this.editMiddleName;
      this.student.last_name       = this.editLastName;
      this.student.contact_number  = this.editContactNumber;
      this.student.birthday        = this.editBirthday;
      this.student.gender          = this.editGender;
      this.student.home_address    = this.editHomeAddress;
      this.student.student_id      = this.editStudentId;
      this.student.school_name     = this.editSchoolName;
      this.student.course          = this.editCourse;
      this.student.year_level      = this.editYearLevel;
      this.student.required_hours  = this.editRequiredHours;
      this.student.completed_hours = this.editCompletedHours;

      this.editMode = false;

      Swal.fire({
        icon: 'success',
        title: 'Profile Updated!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }

  } catch (error: any) {
    Swal.fire({ icon: 'error', title: 'Failed', text: error.message });
  } finally {
    this.saveLoading = false;
  }
}
  goBack() { this.router.navigate(['/admin-ojt']); }

  getFullName(): string {
    if (!this.student) return '';
    return `${this.student.first_name} ${this.student.middle_name ? this.student.middle_name + ' ' : ''}${this.student.last_name}`;
  }

 getPhotoUrl(): string {
  if (this.student?.profile_photo_id) {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${this.student.profile_photo_id}/view?project=${this.PROJECT_ID}`;
  }
  const initials = `${this.student?.first_name?.charAt(0) || 'U'} ${this.student?.last_name?.charAt(0) || ''}`;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2563eb&color=fff&size=128`;
}
  getFileUrl(fileId: string, mode: 'view' | 'download' = 'view'): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/${mode}?project=${this.PROJECT_ID}`;
  }

  getProgress(): number {
  if (!this.student) return 0;
  const completed = this.student.completed_hours || 0;
  const required  = this.student.required_hours  || 500;
  return Math.min(parseFloat(((completed / required) * 100).toFixed(1)), 100);
}
  getRemainingHours(): number {
    if (!this.student) return 0;
    const completed = this.student.completed_hours || 0;
    const required  = this.student.required_hours  || 500;
    return Math.max(required - completed, 0);
  }

  async loadSupervisors() {
  try {
    const res        = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.SUPERVISORS_COL
    );
    this.supervisors = (res.documents as any[])
      .filter(s => (s.status || 'Active') === 'Active');
  } catch (error: any) {
    console.error('Failed to load supervisors:', error.message);
  }
}

getSupervisorName(): string {
  if (!(this.student as any)?.supervisor_id) return '—';
  const sup = this.supervisors.find(s => s.$id === (this.student as any).supervisor_id);
  return sup ? `${sup.first_name} ${sup.last_name}` : '—';
}

}