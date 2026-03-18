import { Injectable } from '@angular/core';
import { Client, Account, Databases, Storage } from 'appwrite';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppwriteService {

  private client: Client;
  account:   Account;
  databases: Databases;
  storage:   Storage;

  readonly DATABASE_ID     = '69ba9274002d52cdef63';
  readonly STUDENTS_COL    = 'students';
  readonly ADMINS_COL      = 'admins';
  readonly TASKS_COL       = 'tasks';
  readonly SUBMISSIONS_COL = 'submissions';
  readonly COMMENTS_COL    = 'comments';

  // ── Shared profile photo state ────────────────────────────
  private photoUrl = new BehaviorSubject<string>('/assets/images/default-profile.png');
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