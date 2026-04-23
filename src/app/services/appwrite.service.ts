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
}