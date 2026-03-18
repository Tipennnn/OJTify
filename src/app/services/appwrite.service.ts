import { Injectable } from '@angular/core';
import { Client, Account, Databases, ID } from 'appwrite';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AppwriteService {

  private client: Client;
  account: Account;
  databases: Databases;

  // Replace with your actual Database ID and Collection ID from Appwrite console
  readonly DATABASE_ID    = '69ba9274002d52cdef63';
  readonly STUDENTS_COL   = 'students';

  constructor() {
    this.client = new Client()
      .setEndpoint(environment.appwriteEndpoint)
      .setProject(environment.appwriteProjectId);

    this.account   = new Account(this.client);
    this.databases = new Databases(this.client);
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