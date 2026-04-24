import { Injectable } from '@angular/core';
import { Client, Account, Databases, Storage, Functions } from 'appwrite';
import { environment } from '../../environments/environment.example';
import { BehaviorSubject } from 'rxjs';
import { Query } from 'appwrite';

@Injectable({ providedIn: 'root' })
export class AppwriteService {

  private client: Client;
  account  : Account;
  databases: Databases;
  storage  : Storage;
  functions: Functions;  // ← just declare it here, no initialization

  readonly DATABASE_ID        = '69ba9274002d52cdef63';
  readonly STUDENTS_COL       = 'students';
  readonly ADMINS_COL         = 'admins';
  readonly TASKS_COL          = 'tasks';
  readonly SUBMISSIONS_COL    = 'submissions';
  readonly COMMENTS_COL       = 'comments';
  readonly APPLICANTS_COL     = 'applicants';
  readonly ATTENDANCE_COL     = 'attendance';
  readonly ARCHIVES_COL       = 'archives';
  readonly SUPERVISORS_COL    = 'supervisors';
  readonly EVALUATIONS_COL    = 'evaluations';
  readonly LOGBOOK_COL        = 'logbook_entries';
  readonly LOGBOOK_PHOTOS_COL = 'logbook_photos';
  readonly DELETE_USER_FN = '69e75aef0017bf366386';

  private photoUrl = new BehaviorSubject<string>(
    'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff&size=128'
  );
  photoUrl$ = this.photoUrl.asObservable();

  updateProfilePhoto(url: string) {
    this.photoUrl.next(url);
  }

  constructor() {
    this.client = new Client()
      .setEndpoint(environment.appwriteEndpoint)
      .setProject(environment.appwriteProjectId);

    this.account   = new Account(this.client);
    this.databases = new Databases(this.client);
    this.storage   = new Storage(this.client);
    this.functions = new Functions(this.client);  // ← initialize here after client is ready
  }

  async signOut() {
    try {
      await this.account.deleteSession('current');
      return { error: null };
    } catch (error) {
      return { error };
    }
  }
 async checkAndArchiveStudent(studentDocId: string) {
  try {
    const student = await this.databases.getDocument(
      this.DATABASE_ID,
      this.STUDENTS_COL,
      studentDocId
    );

    const required  = student['required_hours']  || 500;
    const completed = student['completed_hours'] || 0;

    // ✅ Condition 1: Hours completed
    if (completed < required) return;

    // ✅ Condition 2: Certificate sent
    if (!student['cert_sent']) return;

    // ✅ Condition 3: Has evaluation
    const evalRes = await this.databases.listDocuments(
      this.DATABASE_ID,
      this.EVALUATIONS_COL,
      [Query.equal('student_id_ref', studentDocId), Query.limit(1)]
    );
    if (evalRes.total === 0) return;

    // ✅ All conditions met — check if already archived
    const existing = await this.databases.listDocuments(
      this.DATABASE_ID,
      this.ARCHIVES_COL,
      [Query.equal('student_doc_id', studentDocId)]
    );
    if (existing.total > 0) return; // already archived

    // ✅ Archive the student
    const { ID } = await import('appwrite');
    await this.databases.createDocument(
      this.DATABASE_ID,
      this.ARCHIVES_COL,
      ID.unique(),
      {
        student_doc_id:      studentDocId,
        first_name:          student['first_name'],
        middle_name:         student['middle_name']         || '',
        last_name:           student['last_name'],
        email:               student['email'],
        contact_number:      student['contact_number']      || '',
        birthday:            student['birthday']            || '',
        gender:              student['gender']              || '',
        home_address:        student['home_address']        || '',
        student_id:          student['student_id'],
        school_name:         student['school_name']         || '',
        course:              student['course']              || '',
        year_level:          student['year_level']          || '',
        profile_photo_id:    student['profile_photo_id']    || null,
        resume_file_id:      student['resume_file_id']      || null,
        endorsement_file_id: student['endorsement_file_id'] || null,
        coe_file_id:         student['coe_file_id']         || null,
        required_hours:      required,
        completed_hours:     completed,
        supervisor_id:       student['supervisor_id']       || null,
        ojt_start:           student['ojt_start']           || null,
        ojt_end:             student['ojt_end']             || null,
        archived_at:         new Date().toISOString()
      }
    );

    console.log(`Student ${studentDocId} archived — all 3 conditions met.`);

  } catch (error: any) {
    console.error('Auto-archive failed:', error.message);
  }
}
}