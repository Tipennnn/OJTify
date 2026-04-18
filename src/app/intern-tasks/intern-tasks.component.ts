import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
import { ID } from 'appwrite';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Task {
  $id?: string;
  title: string;
  description: string;
  posted: string;
  due: string;
  status: 'completed' | 'pending';
  assigned_intern_ids?: string;
  attachment_file_id?: string;
  attachment_file_name?: string;
  supervisor_name?: string;
  supervisor_id?: string;
}

interface Submission {
  $id?: string;
  task_id: string;
  student_id: string;
  file_id: string;
  file_name: string;
  submitted_at: string;
}

interface Comment {
  $id?: string;
  task_id: string;
  user_id: string;
  user_name: string;
  role: string;
  message: string;
  created_at: string;
}

// ── Digital Logbook Interfaces ────────────────────────────
interface LogbookEntry {
  $id?: string;
  student_id: string;
  student_name: string;
  entry_date: string;
  tasks_done: string;
  reflection: string;
  created_at: string;
}

interface LogbookPhoto {
  $id?: string;
  entry_id: string;
  student_id: string;
  file_id: string;
  file_name: string;
  uploaded_at: string;
}

@Component({
  selector: 'app-intern-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InternSidenavComponent,
    InternTopnavComponent
  ],
  templateUrl: './intern-tasks.component.html',
  styleUrls: ['./intern-tasks.component.css']
})
export class InternTasksComponent implements OnInit {

  isModalOpen    = false;
  selectedTask   : Task | null = null;
  selectedFile   : File | null = null;
  newComment     = '';
  loading        = false;
  submitLoading  = false;
  commentLoading = false;

  tasks      : Task[]       = [];
  comments   : Comment[]    = [];
  submissions: Submission[] = [];

  currentUserId   = '';
  currentUserName = '';

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';
  private readonly DEPED_LOGO_ID  = '69e3617400102e6fd08e';
  private readonly OCES_LOGO_ID   = '69e3617e00298107dd82';
  private readonly OJTIFY_LOGO_ID = '69e35cb600237a0da105';

  // ── Avatar maps ───────────────────────────────────────────
  // intern $id → profile_photo_id
  internPhotoMap    : Record<string, string> = {};
  // supervisor $id → profile_photo_id
  supervisorPhotoMap: Record<string, string> = {};

  // ── Digital Logbook State ─────────────────────────────────
  activeTab: 'tasks' | 'logbook' = 'tasks';

  logbookEntries : LogbookEntry[] = [];
  logbookLoading = false;

  isLogbookModalOpen   = false;
  logbookModalMode     : 'add' | 'view' = 'add';
  selectedLogbookEntry : LogbookEntry | null = null;

  logbookForm = {
    entry_date : '',
    tasks_done : '',
    reflection : ''
  };
  logbookSaving = false;

  logbookPhotos  : LogbookPhoto[] = [];
  selectedPhoto  : File | null    = null;
  photoUploading = false;

  reportGenerating = false;
  reportWeekStart  = '';
  reportWeekEnd    = '';

  entryPhotoCounts: Record<string, number> = {};

  editingCommentId: string | null = null;
  editingMessage   = '';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.getCurrentUser();
    await Promise.all([
      this.loadInternPhotos(),
      this.loadSupervisorPhotos()
    ]);
    await this.loadTasks();
  }

  // ── Get current logged-in user ────────────────────────────
  async getCurrentUser() {
    try {
      const user = await this.appwrite.account.get();
      this.currentUserId   = user.$id;
      this.currentUserName = user.name || user.email || 'Intern';
    } catch (error: any) {
      console.error('Failed to get user:', error.message);
    }
  }

  // ── Load all intern profile photos ────────────────────────
  async loadInternPhotos() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      (res.documents as any[]).forEach(s => {
        if (s.profile_photo_id) {
          this.internPhotoMap[s.$id] = s.profile_photo_id;
        }
      });
    } catch (error: any) {
      console.error('Failed to load intern photos:', error.message);
    }
  }

  // ── Load all supervisor profile photos ────────────────────
  async loadSupervisorPhotos() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUPERVISORS_COL
      );
      (res.documents as any[]).forEach(s => {
        if (s.profile_photo_id) {
          this.supervisorPhotoMap[s.$id] = s.profile_photo_id;
        }
      });
    } catch (error: any) {
      // SUPERVISORS_COL may not exist in service yet — fail silently
      console.warn('Could not load supervisor photos:', error.message);
    }
  }

  // ── Resolve avatar URL for any comment ───────────────────
  getCommentPhotoUrl(comment: Comment): string | null {
    if (comment.role === 'supervisor') {
      const photoId = this.supervisorPhotoMap[comment.user_id];
      if (!photoId) return null;
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${photoId}/view?project=${this.PROJECT_ID}`;
    } else {
      const photoId = this.internPhotoMap[comment.user_id];
      if (!photoId) return null;
      return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${photoId}/view?project=${this.PROJECT_ID}`;
    }
  }

  // ── Initials helper ───────────────────────────────────────
  getInitials(fullName: string): string {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }

  // ── Load tasks assigned to this intern ────────────────────
  async loadTasks() {
    this.loading = true;
    try {
      const [tasksRes, subsRes] = await Promise.all([
        this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.TASKS_COL),
        this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL)
      ]);

      const allTasks = tasksRes.documents as any[];
      const allSubs  = subsRes.documents as any[];

      const mySubmittedTaskIds = new Set(
        allSubs.filter(s => s.student_id === this.currentUserId).map(s => s.task_id)
      );

      this.tasks = allTasks
        .filter(task => {
          if (!task.assigned_intern_ids) return false;
          return task.assigned_intern_ids.split(',').map((id: string) => id.trim()).includes(this.currentUserId);
        })
        .map(task => ({ ...task, status: mySubmittedTaskIds.has(task.$id) ? 'completed' : 'pending' }));

    } catch (error: any) {
      console.error('Failed to load tasks:', error.message);
    } finally {
      this.loading = false;
    }
  }

  async loadSubmissions(taskId: string) {
    try {
      const res = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL);
      this.submissions = (res.documents as any[]).filter(s => s.task_id === taskId && s.student_id === this.currentUserId);
    } catch (error: any) {
      console.error('Failed to load submissions:', error.message);
    }
  }

  async loadComments(taskId: string) {
    try {
      const res = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL);
      this.comments = (res.documents as any[])
        .filter(c => c.task_id === taskId)
        .sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());
    } catch (error: any) {
      console.error('Failed to load comments:', error.message);
    }
  }

  async sendComment() {
    if (!this.newComment.trim() || !this.selectedTask?.$id) return;
    this.commentLoading = true;
    try {
      const doc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL, ID.unique(),
        { task_id: this.selectedTask.$id, user_id: this.currentUserId, user_name: this.currentUserName, role: 'intern', message: this.newComment.trim(), created_at: new Date().toLocaleString() }
      );
      this.comments.push(doc as any);
      this.newComment = '';
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to send comment', text: error.message });
    } finally {
      this.commentLoading = false;
    }
  }

  startEdit(comment: Comment) {
    this.editingCommentId = comment.$id!;
    this.editingMessage   = comment.message;
  }

  cancelEdit() {
    this.editingCommentId = null;
    this.editingMessage   = '';
  }

  async saveEdit(comment: Comment) {
    if (!this.editingMessage.trim()) return;
    try {
      await this.appwrite.databases.updateDocument(this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL, comment.$id!, { message: this.editingMessage.trim() });
      const index = this.comments.findIndex(c => c.$id === comment.$id);
      if (index !== -1) this.comments[index] = { ...this.comments[index], message: this.editingMessage.trim() };
      this.cancelEdit();
      Swal.fire({ icon: 'success', title: 'Comment updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to update', text: error.message });
    }
  }

  async deleteComment(comment: Comment) {
    const result = await Swal.fire({ title: 'Delete comment?', text: 'This action cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280' });
    if (!result.isConfirmed) return;
    try {
      await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL, comment.$id!);
      this.comments = this.comments.filter(c => c.$id !== comment.$id);
      Swal.fire({ icon: 'success', title: 'Comment deleted!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message });
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.selectedFile = file;
  }

  getFileSize(size: number): string {
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(0) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async submitFile() {
    if (!this.selectedFile) { Swal.fire({ icon: 'warning', title: 'No file selected', text: 'Please choose a file to submit.', confirmButtonColor: '#3b82f6' }); return; }
    if (!this.selectedTask?.$id) return;
    this.submitLoading = true;
    try {
      const uploaded = await this.appwrite.storage.createFile(this.BUCKET_ID, ID.unique(), this.selectedFile);
      const submission = await this.appwrite.databases.createDocument(this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL, ID.unique(), { task_id: this.selectedTask.$id, student_id: this.currentUserId, file_id: uploaded.$id, file_name: this.selectedFile.name, submitted_at: new Date().toLocaleString() });
      this.submissions.unshift(submission as any);
      this.selectedFile = null;
      this.selectedTask.status = 'completed';
      const index = this.tasks.findIndex(t => t.$id === this.selectedTask?.$id);
      if (index !== -1) this.tasks[index].status = 'completed';
      Swal.fire({ icon: 'success', title: 'Submitted!', text: 'Your file has been submitted successfully.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Submission Failed', text: error.message });
    } finally {
      this.submitLoading = false;
    }
  }

  async deleteSubmission(submission: Submission) {
    const result = await Swal.fire({ title: 'Remove submission?', text: 'This will permanently delete your submitted file.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, remove it', cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280' });
    if (!result.isConfirmed) return;
    try {
      await this.appwrite.storage.deleteFile(this.BUCKET_ID, submission.file_id);
      await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL, submission.$id!);
      this.submissions = this.submissions.filter(s => s.$id !== submission.$id);
      if (this.submissions.length === 0) {
        this.selectedTask!.status = 'pending';
        const index = this.tasks.findIndex(t => t.$id === this.selectedTask?.$id);
        if (index !== -1) this.tasks[index].status = 'pending';
      }
      Swal.fire({ icon: 'success', title: 'Removed!', text: 'Your submission has been deleted.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message });
    }
  }

  viewFile(fileId: string) {
    window.open(`${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=${this.PROJECT_ID}`, '_blank');
  }

  async openModal(task: Task) {
    this.selectedTask = task; this.selectedFile = null; this.comments = []; this.submissions = []; this.newComment = ''; this.isModalOpen = true;
    if (task.$id) await Promise.all([this.loadSubmissions(task.$id), this.loadComments(task.$id)]);
  }

  closeModal() {
    this.isModalOpen = false; this.selectedTask = null; this.selectedFile = null; this.comments = []; this.submissions = []; this.newComment = '';
  }

  // ════════════════════════════════════════════════════════
  //  DIGITAL LOGBOOK METHODS
  // ════════════════════════════════════════════════════════

  switchTab(tab: 'tasks' | 'logbook') {
    this.activeTab = tab;
    if (tab === 'logbook' && this.logbookEntries.length === 0) {
      this.loadLogbookEntries().then(() => this.loadAllPhotoCounts());
    }
  }

  async loadLogbookEntries() {
    this.logbookLoading = true;
    try {
      const res = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, 'logbook_entries');
      this.logbookEntries = (res.documents as any[])
        .filter(e => e.student_id === this.currentUserId)
        .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
    } catch (error: any) {
      console.error('Failed to load logbook:', error.message);
    } finally {
      this.logbookLoading = false;
    }
  }

  async loadAllPhotoCounts() {
    try {
      const res = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, 'logbook_photos');
      const mine = (res.documents as any[]).filter(p => p.student_id === this.currentUserId);
      this.entryPhotoCounts = mine.reduce((acc: Record<string, number>, p) => {
        acc[p.entry_id] = (acc[p.entry_id] || 0) + 1;
        return acc;
      }, {});
    } catch {
      this.entryPhotoCounts = {};
    }
  }

  getEntryPhotoCount(entryId: string | undefined): number {
    if (!entryId) return 0;
    return this.entryPhotoCounts[entryId] || 0;
  }

  getTotalPhotos(): number {
    return Object.values(this.entryPhotoCounts).reduce((a, b) => a + b, 0);
  }

  getThisWeekCount(): number {
    const now = new Date();
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    start.setHours(0, 0, 0, 0);
    return this.logbookEntries.filter(e => new Date(e.entry_date) >= start).length;
  }

  getCurrentStreak(): number {
    if (this.logbookEntries.length === 0) return 0;
    const unique = [...new Set(
      [...this.logbookEntries].map(e => new Date(e.entry_date).toDateString())
    )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    let streak = 0;
    const check = new Date();
    check.setHours(0, 0, 0, 0);
    for (const d of unique) {
      const cd = new Date(d);
      cd.setHours(0, 0, 0, 0);
      if (cd.getTime() === check.getTime()) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
    return streak;
  }

  isToday(dateStr: string): boolean {
    return new Date(dateStr).toDateString() === new Date().toDateString();
  }

  getHeadline(tasksDone: string): string {
    if (!tasksDone) return '';
    const first = tasksDone.split('\n')[0].split('.')[0].trim();
    return first.length > 80 ? first.substring(0, 80) + '...' : first;
  }

  getDetailPct(tasksDone: string): number {
    return Math.min(100, Math.round((tasksDone?.length || 0) / 3));
  }

  getGroupedEntries(): { label: string; range: string; entries: LogbookEntry[] }[] {
    if (this.logbookEntries.length === 0) return [];
    const groups: Record<string, { label: string; range: string; entries: LogbookEntry[] }> = {};
    const getWeekKey = (date: Date) => {
      const d = new Date(date); const day = d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      return mon.toISOString().split('T')[0];
    };
    const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const now = new Date();
    const thisKey = getWeekKey(now);
    const lastD = new Date(now); lastD.setDate(now.getDate() - 7);
    const lastKey = getWeekKey(lastD);
    for (const entry of this.logbookEntries) {
      const key = getWeekKey(new Date(entry.entry_date));
      if (!groups[key]) {
        const monDate = new Date(key); const friDate = new Date(key);
        friDate.setDate(monDate.getDate() + 4);
        groups[key] = {
          label: key === thisKey ? 'This week' : key === lastKey ? 'Last week' : 'Earlier',
          range: `${fmtShort(monDate)} – ${fmtShort(friDate)}`,
          entries: []
        };
      }
      groups[key].entries.push(entry);
    }
    return Object.values(groups);
  }

  openAddLogbook() {
    this.logbookModalMode = 'add'; this.selectedLogbookEntry = null; this.logbookPhotos = []; this.selectedPhoto = null;
    this.logbookForm = { entry_date: new Date().toISOString().split('T')[0], tasks_done: '', reflection: '' };
    this.isLogbookModalOpen = true;
  }

  async openViewLogbook(entry: LogbookEntry) {
    this.logbookModalMode = 'view'; this.selectedLogbookEntry = entry;
    this.logbookForm = { entry_date: entry.entry_date, tasks_done: entry.tasks_done, reflection: entry.reflection };
    this.logbookPhotos = []; this.selectedPhoto = null; this.isLogbookModalOpen = true;
    if (entry.$id) await this.loadLogbookPhotos(entry.$id);
  }

  closeLogbookModal() {
    this.isLogbookModalOpen = false; this.selectedLogbookEntry = null; this.logbookPhotos = []; this.selectedPhoto = null;
  }

  async saveLogbookEntry() {
    if (!this.logbookForm.entry_date || !this.logbookForm.tasks_done.trim()) {
      Swal.fire({ icon: 'warning', title: 'Incomplete Entry', text: 'Please fill in the date and tasks done.', confirmButtonColor: '#2563eb' });
      return;
    }
    this.logbookSaving = true;
    try {
      const doc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID, 'logbook_entries', ID.unique(),
        { student_id: this.currentUserId, student_name: this.currentUserName, entry_date: this.logbookForm.entry_date, tasks_done: this.logbookForm.tasks_done.trim(), reflection: this.logbookForm.reflection.trim(), created_at: new Date().toLocaleString() }
      );
      this.logbookEntries.unshift(doc as any);
      if (this.selectedPhoto && doc.$id) await this.uploadLogbookPhoto(doc.$id, this.selectedPhoto);
      this.closeLogbookModal();
      Swal.fire({ icon: 'success', title: 'Entry Saved!', text: 'Your daily logbook entry has been recorded.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to save entry', text: error.message });
    } finally {
      this.logbookSaving = false;
    }
  }

  async deleteLogbookEntry(entry: LogbookEntry) {
    const result = await Swal.fire({ title: 'Delete this entry?', text: 'This will permanently delete the entry and ALL its photos.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280' });
    if (!result.isConfirmed) return;
    try {
      const photosRes = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, 'logbook_photos');
      const entryPhotos = (photosRes.documents as any[]).filter(p => p.entry_id === entry.$id);
      await Promise.allSettled(
        entryPhotos.map(async (photo) => {
          try { await this.appwrite.storage.deleteFile(this.BUCKET_ID, photo.file_id); } catch { }
          await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, 'logbook_photos', photo.$id);
        })
      );
      await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, 'logbook_entries', entry.$id!);
      this.logbookEntries = this.logbookEntries.filter(e => e.$id !== entry.$id);
      if (entry.$id) delete this.entryPhotoCounts[entry.$id];
      Swal.fire({ icon: 'success', title: 'Deleted!', text: `Entry and ${entryPhotos.length} photo(s) have been removed.`, toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, timerProgressBar: true });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message });
    }
  }

  onPhotoSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.selectedPhoto = file;
  }

  async uploadLogbookPhoto(entryId: string, file: File) {
    this.photoUploading = true;
    try {
      const uploaded = await this.appwrite.storage.createFile(this.BUCKET_ID, ID.unique(), file);
      const photoDoc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID, 'logbook_photos', ID.unique(),
        { entry_id: entryId, student_id: this.currentUserId, file_id: uploaded.$id, file_name: file.name, uploaded_at: new Date().toLocaleString() }
      );
      this.logbookPhotos.push(photoDoc as any);
      this.selectedPhoto = null;
      this.entryPhotoCounts[entryId] = (this.entryPhotoCounts[entryId] || 0) + 1;
      Swal.fire({ icon: 'success', title: 'Photo uploaded!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Photo upload failed', text: error.message });
    } finally {
      this.photoUploading = false;
    }
  }

  async addPhotoToExistingEntry() {
    if (!this.selectedPhoto || !this.selectedLogbookEntry?.$id) return;
    await this.uploadLogbookPhoto(this.selectedLogbookEntry.$id, this.selectedPhoto);
  }

  async loadLogbookPhotos(entryId: string) {
    try {
      const res = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, 'logbook_photos');
      this.logbookPhotos = (res.documents as any[]).filter(p => p.entry_id === entryId);
    } catch (error: any) {
      console.error('Failed to load photos:', error.message);
    }
  }

  async deleteLogbookPhoto(photo: LogbookPhoto) {
    const result = await Swal.fire({ title: 'Delete this photo?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete', cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280' });
    if (!result.isConfirmed) return;
    try {
      await this.appwrite.storage.deleteFile(this.BUCKET_ID, photo.file_id);
      await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, 'logbook_photos', photo.$id!);
      this.logbookPhotos = this.logbookPhotos.filter(p => p.$id !== photo.$id);
      if (photo.entry_id && this.entryPhotoCounts[photo.entry_id]) this.entryPhotoCounts[photo.entry_id]--;
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to delete photo', text: error.message });
    }
  }

  getPhotoUrl(fileId: string): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=${this.PROJECT_ID}`;
  }

async generateWeeklyReport() {
  if (!this.reportWeekStart || !this.reportWeekEnd) {
    Swal.fire({ icon: 'warning', title: 'Select a date range', text: 'Please enter the week start and end dates.', confirmButtonColor: '#2563eb' });
    return;
  }
  this.reportGenerating = true;
  try {
    const start = new Date(this.reportWeekStart);
    const end   = new Date(this.reportWeekEnd);
    const weekEntries = this.logbookEntries.filter(e => {
      const d = new Date(e.entry_date); return d >= start && d <= end;
    });

    if (weekEntries.length === 0) {
      Swal.fire({ icon: 'info', title: 'No entries found', text: 'There are no logbook entries for the selected week.', confirmButtonColor: '#2563eb' });
      this.reportGenerating = false; return;
    }

    // Fetch logos as base64
    const toBase64 = (fileId: string): Promise<string> =>
      fetch(`${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=${this.PROJECT_ID}`)
        .then(r => r.blob())
        .then(blob => new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload  = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        }));

    const [depedB64, ocesB64, ojtifyB64] = await Promise.all([
      toBase64(this.DEPED_LOGO_ID).catch(() => ''),
      toBase64(this.OCES_LOGO_ID).catch(() => ''),
      toBase64(this.OJTIFY_LOGO_ID).catch(() => '')
    ]);

    const sortedEntries = weekEntries.sort(
      (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    const rows = sortedEntries.map(e => `
      <tr>
        <td class="col-date">
          <div class="date-day">${new Date(e.entry_date).toLocaleDateString('en-US', { weekday: 'long' })}</div>
          <div class="date-full">${new Date(e.entry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </td>
        <td class="col-tasks">${e.tasks_done.replace(/\n/g, '<br>')}</td>
        <td class="col-reflect">${e.reflection ? e.reflection.replace(/\n/g, '<br>') : '<span style="color:#aaa;">—</span>'}</td>
      </tr>
    `).join('');

    const totalEntries  = sortedEntries.length;
    const weekLabel     = `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Build hidden div, render it, capture with html2canvas, then download
    const container = document.createElement('div');
    container.id = '__logbook-pdf-render';
    container.style.cssText = `
      position: fixed; left: -9999px; top: 0;
      width: 794px; background: #fff;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px; color: #1a1a2e;
      padding: 32px 40px;
    `;

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:3px solid #0818A8;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:14px;">
          ${depedB64  ? `<img src="${depedB64}"  style="height:60px;width:auto;object-fit:contain;" alt="DepEd">` : ''}
          ${depedB64 && ocesB64 ? `<div style="width:1px;height:50px;background:#cbd5e1;"></div>` : ''}
          ${ocesB64   ? `<img src="${ocesB64}"   style="height:60px;width:auto;object-fit:contain;" alt="OCES">` : ''}
        </div>
        <div style="text-align:center;flex:1;padding:0 20px;">
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Department of Education – Schools Division</div>
          <div style="font-size:15px;font-weight:700;color:#0818A8;letter-spacing:0.3px;">Weekly OJT Accomplishment Report</div>
          <div style="font-size:10px;color:#475569;margin-top:2px;">On-the-Job Training Program &nbsp;·&nbsp; Digital Logbook Summary</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-end;">
          ${ojtifyB64 ? `<img src="${ojtifyB64}" style="height:48px;width:auto;object-fit:contain;" alt="OJTify">` : ''}
        </div>
      </div>

      <div style="height:4px;background:linear-gradient(90deg,#0818A8 0%,#2563eb 50%,#06b6d4 100%);margin-bottom:16px;border-radius:0 0 4px 4px;"></div>

      <div style="display:flex;margin-bottom:18px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <div style="flex:1;padding:10px 16px;border-right:1px solid #e2e8f0;background:#0818A8;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#93c5fd;margin-bottom:3px;">Intern Name</div>
          <div style="font-size:11px;font-weight:600;color:#fff;">${this.currentUserName}</div>
        </div>
        <div style="flex:1;padding:10px 16px;border-right:1px solid #e2e8f0;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:3px;">Report Period</div>
          <div style="font-size:11px;font-weight:600;color:#1e293b;">${weekLabel}</div>
        </div>
        <div style="flex:1;padding:10px 16px;border-right:1px solid #e2e8f0;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:3px;">Total Entries</div>
          <div style="font-size:11px;font-weight:600;color:#1e293b;">${totalEntries} day${totalEntries !== 1 ? 's' : ''} logged</div>
        </div>
        <div style="flex:1;padding:10px 16px;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:3px;">Date Generated</div>
          <div style="font-size:11px;font-weight:600;color:#1e293b;">${generatedDate}</div>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:#0818A8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Daily Accomplishments</div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#0818A8;">
            <th style="width:20%;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:10px 12px;text-align:left;">Date</th>
            <th style="width:48%;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:10px 12px;text-align:left;">Tasks / Accomplishments</th>
            <th style="width:32%;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:10px 12px;text-align:left;">Reflections &amp; Learnings</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:24px;text-align:center;">Certification &amp; Approval</div>
        <div style="display:flex;justify-content:space-between;gap:40px;">
          <div style="flex:1;text-align:center;">
            <div style="height:32px;border-bottom:1.5px solid #1e293b;margin-bottom:6px;"></div>
            <div style="font-size:10.5px;font-weight:700;color:#1e293b;">${this.currentUserName}</div>
            <div style="font-size:9px;color:#64748b;margin-top:2px;">OJT Intern</div>
          </div>
          <div style="flex:1;text-align:center;">
            <div style="height:32px;border-bottom:1.5px solid #1e293b;margin-bottom:6px;"></div>
            <div style="font-size:10.5px;font-weight:700;color:#1e293b;">OJT Supervisor</div>
            <div style="font-size:9px;color:#64748b;margin-top:2px;">Immediate Supervisor</div>
          </div>
          <div style="flex:1;text-align:center;">
            <div style="height:32px;border-bottom:1.5px solid #1e293b;margin-bottom:6px;"></div>
            <div style="font-size:10.5px;font-weight:700;color:#1e293b;">OJT Coordinator</div>
            <div style="font-size:9px;color:#64748b;margin-top:2px;">School OJT Coordinator</div>
          </div>
        </div>
      </div>

      <div style="margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:9px;color:#94a3b8;">Generated on ${generatedDate} &nbsp;·&nbsp; Confidential – For Official Use Only</div>
        <div style="font-size:9px;color:#0818A8;font-weight:600;">OJTify · Digital Logbook System</div>
      </div>
    `;

    // Also add row styles via a style tag inside the container
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      #__logbook-pdf-render table tbody tr { border-bottom: 1px solid #e2e8f0; }
      #__logbook-pdf-render table tbody tr:nth-child(even) { background: #f8fafc; }
      #__logbook-pdf-render table tbody td { padding: 10px 12px; vertical-align: top; line-height: 1.5; }
      #__logbook-pdf-render .date-day { font-weight: 700; font-size: 10.5px; color: #0818A8; }
      #__logbook-pdf-render .date-full { font-size: 9.5px; color: #64748b; margin-top: 2px; }
    `;
    container.prepend(styleTag);

    document.body.appendChild(container);

    Swal.fire({
      title: 'Generating PDF…',
      html: '<p style="font-size:13px;color:#6b7280;">Please wait while your report is being prepared.</p>',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    await new Promise(r => setTimeout(r, 200));

    await this.downloadLogbookPDF(container, sortedEntries);

  } catch (error: any) {
    Swal.fire({ icon: 'error', title: 'Report failed', text: error.message });
  } finally {
    this.reportGenerating = false;
    document.getElementById('__logbook-pdf-render')?.remove();
  }
}

private async downloadLogbookPDF(element: HTMLElement, entries: any[]) {
  try {
    const A4_WIDTH_MM  = 210;
    const DPI          = 150;
    const MM_TO_PX     = DPI / 25.4;
    const pageWidthPx  = Math.round(A4_WIDTH_MM * MM_TO_PX);
    const pageHeightPx = Math.round(297 * MM_TO_PX);

    const canvas = await html2canvas(element, {
      scale          : pageWidthPx / 794,
      useCORS        : true,
      allowTaint     : true,
      backgroundColor: '#ffffff',
      logging        : false,
      width          : 794,
      height         : element.scrollHeight,
      windowWidth    : 794,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

    const pageBreaks: number[] = [0];
    let currentEnd = pageHeightPx - Math.round(20 * MM_TO_PX);
    while (currentEnd < canvas.height) {
      pageBreaks.push(currentEnd);
      currentEnd += pageHeightPx - Math.round(20 * MM_TO_PX);
    }
    pageBreaks.push(canvas.height);

    for (let i = 0; i < pageBreaks.length - 1; i++) {
      if (i > 0) pdf.addPage();
      const srcY = pageBreaks[i];
      const srcH = pageBreaks[i + 1] - srcY;
      if (srcH <= 0) continue;

      const slice = document.createElement('canvas');
      slice.width  = canvas.width;
      slice.height = srcH;
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      const sliceHmm = (srcH / canvas.width) * A4_WIDTH_MM;
      pdf.addImage(slice.toDataURL('image/jpeg', 0.82), 'JPEG', 0, 0, A4_WIDTH_MM, sliceHmm, undefined, 'FAST');
    }

    const fileName = `OJT-Logbook-${this.currentUserName.replace(/\s+/g, '-')}-${this.reportWeekStart}.pdf`;
    pdf.save(fileName);

    Swal.fire({
      icon: 'success', title: 'Downloaded!',
      text: `Saved as ${fileName}`,
      confirmButtonColor: '#2563eb',
      timer: 2500, showConfirmButton: false
    });

  } catch (err: any) {
    Swal.fire({ icon: 'error', title: 'Download Failed', text: 'Could not generate PDF. Please try again.', confirmButtonColor: '#2563eb' });
  }
}

  formatEntryDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }
}