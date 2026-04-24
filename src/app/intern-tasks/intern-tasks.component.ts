import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
import { ID, Query } from 'appwrite';
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
  score?: number | null;
   submissionScore?: number | null;
}

interface Submission {
  $id?: string;
  task_id: string;
  student_id: string;
  file_id: string;
  file_name: string;
  submitted_at: string;
  score?: number | null;
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

interface LogbookEntry {
  $id?: string;
  student_id: string;
  student_name: string;
  entry_date: string;
  tasks_done: string;
  reflection: string;
  created_at: string;
  score?: number | null;
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
  imports: [CommonModule, FormsModule, InternSidenavComponent, InternTopnavComponent],
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

  // Word limits
  readonly TASKS_DONE_WORD_LIMIT  = 150;
  readonly REFLECTION_WORD_LIMIT  = 80;

  readonly MAX_PHOTOS = 5;

  internPhotoMap    : Record<string, string> = {};
  supervisorPhotoMap: Record<string, string> = {};

  // ── Logbook State ─────────────────────────────────────
  activeTab: 'tasks' | 'logbook' = 'tasks';

  logbookEntries : LogbookEntry[] = [];
  logbookLoading = false;

  isLogbookModalOpen   = false;
  logbookModalMode     : 'add' | 'view' | 'edit' = 'add';
  selectedLogbookEntry : LogbookEntry | null = null;

  logbookForm = { entry_date: '', tasks_done: '', reflection: '' };
  logbookSaving = false;

  logbookPhotos  : LogbookPhoto[] = [];
  selectedPhotos : File[]         = [];
  photoUploading = false;

  reportGenerating = false;
  reportWeekStart  = '';
  reportWeekEnd    = '';

  entryPhotoCounts: Record<string, number> = {};

  editingCommentId: string | null = null;
  editingMessage   = '';

  // Word count tracking for live counters
  tasksDoneWordCount  = 0;
  reflectionWordCount = 0;

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.getCurrentUser();
    await Promise.all([this.loadInternPhotos(), this.loadSupervisorPhotos()]);
    await this.loadTasks();
  }

  async getCurrentUser() {
    try {
      const user = await this.appwrite.account.get();
      this.currentUserId   = user.$id;
      this.currentUserName = user.name || user.email || 'Intern';
    } catch (error: any) { console.error('Failed to get user:', error.message); }
  }

  async loadInternPhotos() {
    try {
      const res = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL);
      (res.documents as any[]).forEach(s => { if (s.profile_photo_id) this.internPhotoMap[s.$id] = s.profile_photo_id; });
    } catch (error: any) { console.error('Failed to load intern photos:', error.message); }
  }

  async loadSupervisorPhotos() {
  try {
    const res = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, this.appwrite.SUPERVISORS_COL);
    (res.documents as any[]).forEach(s => {
      // Key by both $id AND employee_id to cover both cases
      if (s.profile_photo_id) {
        this.supervisorPhotoMap[s.$id] = s.profile_photo_id;
        if (s.employee_id) this.supervisorPhotoMap[s.employee_id] = s.profile_photo_id;
      }
    });
  } catch (error: any) { console.warn('Could not load supervisor photos:', error.message); }
}

  getCommentPhotoUrl(comment: Comment): string | null {
    const map = comment.role === 'supervisor' ? this.supervisorPhotoMap : this.internPhotoMap;
    const photoId = map[comment.user_id];
    if (!photoId) return null;
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${photoId}/view?project=${this.PROJECT_ID}`;
  }

  getInitials(fullName: string): string {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }

  async loadTasks() {
  this.loading = true;
  try {
    const [tasksRes, subsRes] = await Promise.all([
      this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, this.appwrite.TASKS_COL,
        [Query.limit(500)]                          // ← FIX: was missing limit
      ),
      this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL,
        [Query.limit(5000)]                         // ← FIX: was missing limit
      )
    ]);
    const allTasks = tasksRes.documents as any[];
    const allSubs  = subsRes.documents as any[];
 
    // My submissions only
    const mySubs           = allSubs.filter(s => s.student_id === this.currentUserId);
    const mySubmittedTaskIds = new Set(mySubs.map(s => s.task_id));
 
    // Build a map: taskId → submission score
    const mySubScoreMap: { [taskId: string]: number | null } = {};
    mySubs.forEach(s => {
      mySubScoreMap[s.task_id] = s.score ?? null;
    });
 
   this.tasks = allTasks
  .filter(task => task.assigned_intern_ids?.split(',').map((id: string) => id.trim()).includes(this.currentUserId))
  .map(task => ({
    ...task,
    status: mySubmittedTaskIds.has(task.$id) ? 'completed' : 'pending',
    submissionScore: mySubScoreMap[task.$id] ?? null,
    supervisor_id: task.supervisor_id ?? undefined
  }))
  .sort((a, b) => new Date(b.posted).getTime() - new Date(a.posted).getTime());
 
  } catch (error: any) { console.error('Failed to load tasks:', error.message); }
  finally { this.loading = false; }
}
  async loadSubmissions(taskId: string) {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL,
      [Query.limit(500)]                            // ← FIX: was missing limit
    );
    this.submissions = (res.documents as any[])
      .filter(s => s.task_id === taskId && s.student_id === this.currentUserId);
 
    // Also refresh the score on the selected task from the submission
    if (this.selectedTask && this.submissions.length > 0) {
      (this.selectedTask as any).submissionScore = this.submissions[0].score ?? null;
    }
  } catch (error: any) { console.error('Failed to load submissions:', error.message); }
}

  async loadComments(taskId: string) {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL,
      [Query.limit(500)]
    );
    this.comments = (res.documents as any[])
      .filter(c =>
        c.task_id === taskId &&
        (c.user_id === this.currentUserId || c.role === 'supervisor' || c.role === 'admin')
      )
      .sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());
  } catch (error: any) { console.error('Failed to load comments:', error.message); }
}

  async sendComment() {
    if (!this.newComment.trim() || !this.selectedTask?.$id) return;
    this.commentLoading = true;
    try {
      const doc = await this.appwrite.databases.createDocument(this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL, ID.unique(),
        { task_id: this.selectedTask.$id, user_id: this.currentUserId, user_name: this.currentUserName, role: 'intern', message: this.newComment.trim(), created_at: new Date().toLocaleString() });
      this.comments.push(doc as any);
      this.newComment = '';
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to send comment', text: error.message }); }
    finally { this.commentLoading = false; }
  }

  startEdit(comment: Comment) { this.editingCommentId = comment.$id!; this.editingMessage = comment.message; }
  cancelCommentEdit() { this.editingCommentId = null; this.editingMessage = ''; }

  async saveEdit(comment: Comment) {
    if (!this.editingMessage.trim()) return;
    try {
      await this.appwrite.databases.updateDocument(this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL, comment.$id!, { message: this.editingMessage.trim() });
      const i = this.comments.findIndex(c => c.$id === comment.$id);
      if (i !== -1) this.comments[i] = { ...this.comments[i], message: this.editingMessage.trim() };
      this.cancelCommentEdit();
      Swal.fire({ icon: 'success', title: 'Comment updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to update', text: error.message }); }
  }

  async deleteComment(comment: Comment) {
    const result = await Swal.fire({ title: 'Delete comment?', text: 'This action cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280' });
    if (!result.isConfirmed) return;
    try {
      await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, this.appwrite.COMMENTS_COL, comment.$id!);
      this.comments = this.comments.filter(c => c.$id !== comment.$id);
      Swal.fire({ icon: 'success', title: 'Comment deleted!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message }); }
  }

  onFileSelected(event: any) { const file = event.target.files[0]; if (file) this.selectedFile = file; }

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
      const submission = await this.appwrite.databases.createDocument(this.appwrite.DATABASE_ID, this.appwrite.SUBMISSIONS_COL, ID.unique(),
        { task_id: this.selectedTask.$id, student_id: this.currentUserId, file_id: uploaded.$id, file_name: this.selectedFile.name, submitted_at: new Date().toLocaleString() });
      this.submissions.unshift(submission as any);
      this.selectedFile = null;
      this.selectedTask.status = 'completed';
      const idx = this.tasks.findIndex(t => t.$id === this.selectedTask?.$id);
      if (idx !== -1) this.tasks[idx].status = 'completed';
      Swal.fire({ icon: 'success', title: 'Submitted!', text: 'Your file has been submitted successfully.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Submission Failed', text: error.message }); }
    finally { this.submitLoading = false; }
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
        const idx = this.tasks.findIndex(t => t.$id === this.selectedTask?.$id);
        if (idx !== -1) this.tasks[idx].status = 'pending';
      }
      Swal.fire({ icon: 'success', title: 'Removed!', text: 'Your submission has been deleted.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message }); }
  }

  async openModal(task: Task) {
    console.log('supervisor_id:', task.supervisor_id);
  console.log('supervisorPhotoMap:', this.supervisorPhotoMap);
    this.selectedTask = task; this.selectedFile = null; this.comments = []; this.submissions = []; this.newComment = ''; this.isModalOpen = true;
    if (task.$id) await Promise.all([this.loadSubmissions(task.$id), this.loadComments(task.$id)]);
  }

  closeModal() { this.isModalOpen = false; this.selectedTask = null; this.selectedFile = null; this.comments = []; this.submissions = []; this.newComment = ''; }

  // ── Date formatting helpers ───────────────────────────
  formatLongDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  getDueDateParts(due: string): { day: string; num: string; month: string } {
    const d = new Date(due);
    if (isNaN(d.getTime())) return { day: '', num: due, month: '' };
    return {
      day:   d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      num:   d.getDate().toString(),
      month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    };
  }

  // ── Score helpers ─────────────────────────────────────
  getScoreDisplay(score: number | null | undefined): { label: string; cls: string; icon: string } {
    if (score === null || score === undefined) {
      return { label: 'Not yet scored', cls: 'score-pending', icon: 'fas fa-hourglass-half' };
    }
    if (score >= 90) return { label: `${score}/100`, cls: 'score-excellent', icon: 'fas fa-star' };
    if (score >= 75) return { label: `${score}/100`, cls: 'score-good', icon: 'fas fa-check-circle' };
    if (score >= 60) return { label: `${score}/100`, cls: 'score-average', icon: 'fas fa-minus-circle' };
    return { label: `${score}/100`, cls: 'score-low', icon: 'fas fa-exclamation-circle' };
  }

  // ════════════════════════════════════════════════════════
  //  LOGBOOK METHODS
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
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, 'logbook_entries',
      [Query.limit(5000)]                           // ← FIX: was missing limit
    );
    this.logbookEntries = (res.documents as any[])
      .filter(e => e.student_id === this.currentUserId)
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  } catch (error: any) { console.error('Failed to load logbook:', error.message); }
  finally { this.logbookLoading = false; }
}

  async loadAllPhotoCounts() {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, 'logbook_photos',
      [Query.limit(5000)]                           // ← FIX: was missing limit
    );
    const mine = (res.documents as any[]).filter(p => p.student_id === this.currentUserId);
    this.entryPhotoCounts = mine.reduce((acc: Record<string, number>, p) => {
      acc[p.entry_id] = (acc[p.entry_id] || 0) + 1; return acc;
    }, {});
  } catch { this.entryPhotoCounts = {}; }
}
  getEntryPhotoCount(entryId: string | undefined): number { return entryId ? (this.entryPhotoCounts[entryId] || 0) : 0; }
  getTotalPhotos(): number { return Object.values(this.entryPhotoCounts).reduce((a, b) => a + b, 0); }

  getThisWeekCount(): number {
    const now = new Date(); const day = now.getDay();
    const start = new Date(now); start.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); start.setHours(0,0,0,0);
    return this.logbookEntries.filter(e => new Date(e.entry_date) >= start).length;
  }

  getCurrentStreak(): number {
    if (this.logbookEntries.length === 0) return 0;
    const unique = [...new Set([...this.logbookEntries].map(e => new Date(e.entry_date).toDateString()))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    let streak = 0; const check = new Date(); check.setHours(0,0,0,0);
    for (const d of unique) { const cd = new Date(d); cd.setHours(0,0,0,0); if (cd.getTime() === check.getTime()) { streak++; check.setDate(check.getDate() - 1); } else break; }
    return streak;
  }

  isToday(dateStr: string): boolean { return new Date(dateStr).toDateString() === new Date().toDateString(); }

  isEntryEditable(entry: LogbookEntry): boolean {
    const entryDate = new Date(entry.entry_date);
    const now = new Date();
    const sameDay =
      entryDate.getFullYear() === now.getFullYear() &&
      entryDate.getMonth()    === now.getMonth()    &&
      entryDate.getDate()     === now.getDate();
    const endOfDay = new Date(entryDate);
    endOfDay.setHours(23, 59, 59, 999);
    return sameDay && now <= endOfDay;
  }

  dateHasEntry(dateStr: string): boolean {
    return this.logbookEntries.some(e => e.entry_date === dateStr);
  }

  getTodayString(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const dd   = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  isFutureDate(dateStr: string): boolean {
    if (!dateStr) return false;
    return dateStr > this.getTodayString();
  }

  // ── Word count helpers ──────────────────────────────────
  countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  wordCount(text: string): number { return this.countWords(text); }

  private validateWordCounts(): boolean {
    if (this.tasksDoneWordCount > this.TASKS_DONE_WORD_LIMIT) {
      Swal.fire({
        icon: 'warning',
        title: 'Tasks Done too long',
        text: `Your Tasks Done has ${this.tasksDoneWordCount} words, which exceeds the ${this.TASKS_DONE_WORD_LIMIT}-word limit. Please shorten it before saving.`,
        confirmButtonColor: '#2563eb'
      });
      return false;
    }
    if (this.reflectionWordCount > this.REFLECTION_WORD_LIMIT) {
      Swal.fire({
        icon: 'warning',
        title: 'Reflection too long',
        text: `Your Reflection has ${this.reflectionWordCount} words, which exceeds the ${this.REFLECTION_WORD_LIMIT}-word limit. Please shorten it before saving.`,
        confirmButtonColor: '#2563eb'
      });
      return false;
    }
    return true;
  }

  getHeadline(text: string): string {
    if (!text) return '';
    const first = text.split('\n')[0].split('.')[0].trim();
    const words = first.split(' ');
    const trimmed = words.slice(0, 9).join(' ');
    return words.length > 9 ? trimmed + '…' : trimmed;
  }

  getTimeOnly(createdAt: string): string {
    if (!createdAt) return '';
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    const match = createdAt.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    return match ? match[1] : createdAt;
  }

  getDetailPct(tasksDone: string): number { return Math.min(100, Math.round((tasksDone?.length || 0) / 3)); }

  onTasksInput(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    this.logbookForm.tasks_done = el.value;
    this.tasksDoneWordCount = this.countWords(el.value);
  }

  onTasksEnter(event: Event) {
    event.preventDefault();
    const el = event.target as HTMLTextAreaElement;
    const val = el.value;
    const pos = el.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const after = val.slice(pos);
    const newVal = before + '\n• ' + after;
    this.logbookForm.tasks_done = newVal;
    this.tasksDoneWordCount = this.countWords(newVal);
    setTimeout(() => {
      el.value = newVal;
      const newPos = pos + 3;
      el.setSelectionRange(newPos, newPos);
    });
  }

  onReflectionInput(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    this.logbookForm.reflection = el.value;
    this.reflectionWordCount = this.countWords(el.value);
  }

  getBulletItems(text: string): string[] {
    if (!text) return [];
    return text
      .split('\n')
      .map(line => line.replace(/^•\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  getGroupedEntries(): { label: string; range: string; entries: LogbookEntry[] }[] {
    if (this.logbookEntries.length === 0) return [];
    const groups: Record<string, { label: string; range: string; entries: LogbookEntry[] }> = {};
    const getWeekKey = (date: Date) => { const d = new Date(date); const day = d.getDay(); const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return mon.toISOString().split('T')[0]; };
    const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const now = new Date(); const thisKey = getWeekKey(now); const lastD = new Date(now); lastD.setDate(now.getDate() - 7); const lastKey = getWeekKey(lastD);
    for (const entry of this.logbookEntries) {
      const key = getWeekKey(new Date(entry.entry_date));
      if (!groups[key]) {
        const monDate = new Date(key); const friDate = new Date(key); friDate.setDate(monDate.getDate() + 4);
        groups[key] = { label: key === thisKey ? 'This week' : key === lastKey ? 'Last week' : 'Earlier', range: `${fmtShort(monDate)} – ${fmtShort(friDate)}`, entries: [] };
      }
      groups[key].entries.push(entry);
    }
    return Object.values(groups);
  }

  openAddLogbook() {
    this.logbookModalMode = 'add';
    this.selectedLogbookEntry = null;
    this.logbookPhotos = [];
    this.selectedPhotos = [];
    this.logbookForm = { entry_date: new Date().toISOString().split('T')[0], tasks_done: '• ', reflection: '' };
    this.tasksDoneWordCount = 0;
    this.reflectionWordCount = 0;
    this.isLogbookModalOpen = true;
  }

  async openViewLogbook(entry: LogbookEntry) {
    this.logbookModalMode = 'view';
    this.selectedLogbookEntry = entry;
    this.logbookForm = { entry_date: entry.entry_date, tasks_done: entry.tasks_done, reflection: entry.reflection };
    this.logbookPhotos = [];
    this.selectedPhotos = [];
    this.isLogbookModalOpen = true;
    if (entry.$id) await this.loadLogbookPhotos(entry.$id);
  }

  async openEditLogbook(entry: LogbookEntry) {
    if (!this.isEntryEditable(entry)) {
      Swal.fire({
        icon: 'info',
        title: 'Entry locked',
        text: 'This entry can no longer be edited. Entries can only be modified until 11:59 PM on the day they were created.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }
    this.logbookModalMode = 'edit';
    this.selectedLogbookEntry = entry;
    this.logbookForm = { entry_date: entry.entry_date, tasks_done: entry.tasks_done, reflection: entry.reflection };
    this.tasksDoneWordCount = this.countWords(entry.tasks_done);
    this.reflectionWordCount = this.countWords(entry.reflection);
    this.logbookPhotos = [];
    this.selectedPhotos = [];
    this.isLogbookModalOpen = true;
    if (entry.$id) await this.loadLogbookPhotos(entry.$id);
  }

  closeLogbookModal() {
    this.isLogbookModalOpen = false;
    this.selectedLogbookEntry = null;
    this.logbookPhotos = [];
    this.selectedPhotos = [];
    this.tasksDoneWordCount = 0;
    this.reflectionWordCount = 0;
  }

  cancelEdit() {
    if (this.selectedLogbookEntry) {
      this.openViewLogbook(this.selectedLogbookEntry);
    } else {
      this.closeLogbookModal();
    }
  }

  async saveLogbookEntry() {
    if (!this.logbookForm.entry_date || !this.logbookForm.tasks_done.trim()) {
      Swal.fire({ icon: 'warning', title: 'Incomplete Entry', text: 'Please fill in the date and tasks done.', confirmButtonColor: '#2563eb' }); return;
    }

    if (this.isFutureDate(this.logbookForm.entry_date)) {
      Swal.fire({
        icon: 'warning',
        title: 'Future date not allowed',
        text: 'You cannot log an entry for a future date. Please select today or a past date.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    if (!this.validateWordCounts()) return;

    if (this.dateHasEntry(this.logbookForm.entry_date)) {
      Swal.fire({ icon: 'warning', title: 'Entry already exists', text: 'You already have a logbook entry for this date. Only one entry per day is allowed.', confirmButtonColor: '#2563eb' }); return;
    }
    this.logbookSaving = true;
    try {
      const doc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID, 'logbook_entries', ID.unique(),
        {
          student_id: this.currentUserId,
          student_name: this.currentUserName,
          entry_date: this.logbookForm.entry_date,
          tasks_done: this.logbookForm.tasks_done.trim(),
          reflection: this.logbookForm.reflection.trim(),
          created_at: new Date().toISOString()
        }
      );
      this.logbookEntries.unshift(doc as any);

   if (this.selectedPhotos.length > 0) {
  const failed: string[] = [];
  for (const photo of this.selectedPhotos) {
    try {
      await this.uploadLogbookPhotoSilent((doc as any).$id, photo);
    } catch {
      failed.push(photo.name);
    }
  }
  if (failed.length > 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Some photos failed',
      text: `These photos could not be uploaded: ${failed.join(', ')}. You can add them in Edit mode.`,
      confirmButtonColor: '#2563eb'
    });
    this.closeLogbookModal();
    return;
  }
}

      this.closeLogbookModal();
      Swal.fire({
        icon: 'success',
        title: 'Entry Saved!',
        text: this.selectedPhotos ? 'Your entry and photo have been saved.' : 'Your daily logbook entry has been recorded.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to save entry', text: error.message });
    } finally {
      this.logbookSaving = false;
    }
  }

  async updateLogbookEntry() {
    if (!this.logbookForm.entry_date || !this.logbookForm.tasks_done.trim()) {
      Swal.fire({ icon: 'warning', title: 'Incomplete Entry', text: 'Please fill in the date and tasks done.', confirmButtonColor: '#2563eb' }); return;
    }

    if (this.isFutureDate(this.logbookForm.entry_date)) {
      Swal.fire({
        icon: 'warning',
        title: 'Future date not allowed',
        text: 'You cannot set the entry date to a future date.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    if (!this.validateWordCounts()) return;

    if (!this.selectedLogbookEntry?.$id) return;
    if (!this.isEntryEditable(this.selectedLogbookEntry)) {
      Swal.fire({ icon: 'info', title: 'Entry locked', text: 'This entry can no longer be edited after 11:59 PM of the entry date.', confirmButtonColor: '#2563eb' }); return;
    }
    this.logbookSaving = true;
    try {
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID, 'logbook_entries', this.selectedLogbookEntry.$id,
        { entry_date: this.logbookForm.entry_date, tasks_done: this.logbookForm.tasks_done.trim(), reflection: this.logbookForm.reflection.trim() }
      );
      const idx = this.logbookEntries.findIndex(e => e.$id === this.selectedLogbookEntry!.$id);
      if (idx !== -1) {
        this.logbookEntries[idx] = {
          ...this.logbookEntries[idx],
          entry_date: this.logbookForm.entry_date,
          tasks_done: this.logbookForm.tasks_done.trim(),
          reflection: this.logbookForm.reflection.trim()
        };
      }
      for (const photo of this.selectedPhotos) {
  await this.uploadLogbookPhotoSilent(this.selectedLogbookEntry.$id, photo);
}
      this.closeLogbookModal();
      Swal.fire({ icon: 'success', title: 'Entry Updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, timerProgressBar: true });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to update entry', text: error.message });
    } finally {
      this.logbookSaving = false;
    }
  }

  async deleteLogbookEntry(entry: LogbookEntry) {
    if (!this.isEntryEditable(entry)) { return; }
    const result = await Swal.fire({ title: 'Delete this entry?', text: 'This will permanently delete the entry and ALL its photos.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280' });
    if (!result.isConfirmed) return;
    await this._doDeleteEntry(entry);
  }

  async deleteCurrentLogbookEntry() {
    if (!this.selectedLogbookEntry) return;
    if (!this.isEntryEditable(this.selectedLogbookEntry)) {
      Swal.fire({ icon: 'info', title: 'Entry locked', text: 'This entry can no longer be deleted after 11:59 PM of the entry date.', confirmButtonColor: '#2563eb' }); return;
    }
    const result = await Swal.fire({ title: 'Delete this entry?', text: 'This will permanently delete the entry and ALL its photos.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280' });
    if (!result.isConfirmed) return;
    this.closeLogbookModal();
    await this._doDeleteEntry(this.selectedLogbookEntry);
  }

  private async _doDeleteEntry(entry: LogbookEntry) {
    try {
      const photosRes = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, 'logbook_photos');
      const entryPhotos = (photosRes.documents as any[]).filter(p => p.entry_id === entry.$id);
      await Promise.allSettled(entryPhotos.map(async (photo) => {
        try { await this.appwrite.storage.deleteFile(this.BUCKET_ID, photo.file_id); } catch { }
        await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, 'logbook_photos', photo.$id);
      }));
      await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, 'logbook_entries', entry.$id!);
      this.logbookEntries = this.logbookEntries.filter(e => e.$id !== entry.$id);
      if (entry.$id) delete this.entryPhotoCounts[entry.$id];
      Swal.fire({ icon: 'success', title: 'Deleted!', text: `Entry and ${entryPhotos.length} photo(s) removed.`, toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message }); }
  }

  onPhotoSelected(event: any) {
  const files: FileList = event.target.files;
  if (!files || files.length === 0) return;

  const remaining = this.MAX_PHOTOS - this.logbookPhotos.length - this.selectedPhotos.length;
  if (remaining <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Photo limit reached',
      text: `You can only attach up to ${this.MAX_PHOTOS} photos per entry.`,
      confirmButtonColor: '#2563eb'
    });
    event.target.value = '';
    return;
  }

  const toAdd = Array.from(files).slice(0, remaining);
  const skipped = files.length - toAdd.length;

  this.selectedPhotos.push(...toAdd);

  if (skipped > 0) {
    Swal.fire({
      icon: 'info',
      title: `${skipped} photo(s) skipped`,
      text: `Only ${toAdd.length} photo(s) were added to stay within the ${this.MAX_PHOTOS}-photo limit.`,
      confirmButtonColor: '#2563eb'
    });
  }

  event.target.value = ''; // reset so same files can be re-selected if needed
}

 private async uploadLogbookPhotoSilent(entryId: string, file: File) {
  if (this.logbookPhotos.length >= this.MAX_PHOTOS) {
    throw new Error(`Photo limit of ${this.MAX_PHOTOS} reached for this entry.`);
  }
  const uploaded = await this.appwrite.storage.createFile(this.BUCKET_ID, ID.unique(), file);
  const photoDoc = await this.appwrite.databases.createDocument(
    this.appwrite.DATABASE_ID, 'logbook_photos', ID.unique(),
    { entry_id: entryId, student_id: this.currentUserId, file_id: uploaded.$id, file_name: file.name, uploaded_at: new Date().toLocaleString() }
  );
  this.logbookPhotos.push(photoDoc as any);

  this.entryPhotoCounts[entryId] = (this.entryPhotoCounts[entryId] || 0) + 1;
}

  async uploadLogbookPhoto(entryId: string, file: File) {
    this.photoUploading = true;
    try {
      await this.uploadLogbookPhotoSilent(entryId, file);
      Swal.fire({ icon: 'success', title: 'Photo uploaded!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Photo upload failed', text: error.message }); }
    finally { this.photoUploading = false; }
  }

 async loadLogbookPhotos(entryId: string) {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID, 'logbook_photos',
      [Query.limit(500)]                            // ← FIX: was missing limit
    );
    this.logbookPhotos = (res.documents as any[]).filter(p => p.entry_id === entryId);
  } catch (error: any) { console.error('Failed to load photos:', error.message); }
}
 
  async deleteLogbookPhoto(photo: LogbookPhoto) {
    const result = await Swal.fire({ title: 'Delete this photo?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete', cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280' });
    if (!result.isConfirmed) return;
    try {
      await this.appwrite.storage.deleteFile(this.BUCKET_ID, photo.file_id);
      await this.appwrite.databases.deleteDocument(this.appwrite.DATABASE_ID, 'logbook_photos', photo.$id!);
      this.logbookPhotos = this.logbookPhotos.filter(p => p.$id !== photo.$id);
      if (photo.entry_id && this.entryPhotoCounts[photo.entry_id]) this.entryPhotoCounts[photo.entry_id]--;
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Failed to delete photo', text: error.message }); }
  }

  getPhotoUrl(fileId: string): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=${this.PROJECT_ID}`;
  }

  // ════════════════════════════════════════════════════════
  //  WEEKLY REPORT PDF
  // ════════════════════════════════════════════════════════
  async generateWeeklyReport() {
    if (!this.reportWeekStart || !this.reportWeekEnd) {
      Swal.fire({ icon: 'warning', title: 'Select a date range', text: 'Please enter the week start and end dates.', confirmButtonColor: '#2563eb' }); return;
    }
    this.reportGenerating = true;
    try {
      const start = new Date(this.reportWeekStart);
      const end   = new Date(this.reportWeekEnd);
      end.setHours(23, 59, 59, 999);

      const weekEntries = this.logbookEntries.filter(e => { const d = new Date(e.entry_date); return d >= start && d <= end; });
      if (weekEntries.length === 0) {
        Swal.fire({ icon: 'info', title: 'No entries found', text: 'There are no logbook entries for the selected date range.', confirmButtonColor: '#2563eb' });
        this.reportGenerating = false; return;
      }

      const sortedEntries = [...weekEntries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

      const allPhotosRes = await this.appwrite.databases.listDocuments(this.appwrite.DATABASE_ID, 'logbook_photos');
      const allPhotos    = allPhotosRes.documents as any[];
      const entryIds     = new Set(sortedEntries.map(e => e.$id));
      const rangePhotos  = allPhotos.filter(p => entryIds.has(p.entry_id) && p.student_id === this.currentUserId);

      const toBase64 = (url: string): Promise<string> =>
        fetch(url).then(r => r.blob()).then(blob => new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload  = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        }));

      interface PhotoItem { b64: string; name: string; entryDate: string; uploadedAt: string; }
      const photoMap: Record<string, PhotoItem[]> = {};

      await Promise.allSettled(rangePhotos.map(async (photo) => {
        try {
          const b64 = await toBase64(this.getPhotoUrl(photo.file_id));
          const entry = sortedEntries.find(e => e.$id === photo.entry_id);
          const entryDate = entry ? new Date(entry.entry_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
          const uploadedAt = photo.uploaded_at || '';
          if (!photoMap[photo.entry_id]) photoMap[photo.entry_id] = [];
          photoMap[photo.entry_id].push({ b64, name: photo.file_name, entryDate, uploadedAt });
        } catch { /* skip */ }
      }));

      const totalEntries  = sortedEntries.length;
      const weekLabel     = `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      const allPhotoItems: PhotoItem[] = [];
      for (const entry of sortedEntries) {
        allPhotoItems.push(...(photoMap[entry.$id!] || []));
      }

      const rows = sortedEntries.map(e => {
        const photoCount = (photoMap[e.$id!] || []).length;
        return `
          <tr>
            <td class="col-date">
              <div class="date-day">${new Date(e.entry_date).toLocaleDateString('en-US', { weekday: 'long' })}</div>
              <div class="date-full">${new Date(e.entry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
              ${photoCount > 0 ? `<div style="font-size:9px;color:#2563eb;margin-top:4px;">📷 ${photoCount} photo${photoCount > 1 ? 's' : ''} — see Photo Evidence</div>` : ''}
            </td>
            <td class="col-tasks">${e.tasks_done.replace(/\n/g, '<br>')}</td>
            <td class="col-reflect">${e.reflection ? e.reflection.replace(/\n/g, '<br>') : '<span style="color:#aaa;">—</span>'}</td>
          </tr>
        `;
      }).join('');

      const page1 = document.createElement('div');
      page1.id = '__pdf-page1';
      page1.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:"Segoe UI",Arial,sans-serif;font-size:11px;color:#1a1a2e;padding:20px 40px 20px 40px;box-sizing:border-box;';

      page1.innerHTML = `
        <div style="text-align:center; padding-bottom:14px; border-bottom:3px solid #2563eb; margin-bottom:4px;">
          <div style="font-size:15px; font-weight:700; color:#1e293b; letter-spacing:0.2px;">Weekly OJT Accomplishment Report</div>
          <div style="font-size:10px; color:#64748b; margin-top:3px;">On-the-Job Training Program &nbsp;·&nbsp; Digital Logbook Summary</div>
        </div>
        <div style="height:4px; background:linear-gradient(90deg,#2563eb 0%,#1d4ed8 50%,#60a5fa 100%); margin-bottom:14px; border-radius:0 0 4px 4px;"></div>
        <div style="display:flex; margin-bottom:14px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
          <div style="flex:1; padding:8px 14px; border-right:1px solid #e2e8f0; background:#2563eb;">
            <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.6px; color:#bfdbfe; margin-bottom:2px;">Intern Name</div>
            <div style="font-size:11px; font-weight:600; color:#fff;">${this.currentUserName}</div>
          </div>
          <div style="flex:1; padding:8px 14px; border-right:1px solid #e2e8f0;">
            <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.6px; color:#94a3b8; margin-bottom:2px;">Report Period</div>
            <div style="font-size:11px; font-weight:600; color:#1e293b;">${weekLabel}</div>
          </div>
          <div style="flex:1; padding:8px 14px; border-right:1px solid #e2e8f0;">
            <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.6px; color:#94a3b8; margin-bottom:2px;">Total Entries</div>
            <div style="font-size:11px; font-weight:600; color:#1e293b;">${totalEntries} day${totalEntries !== 1 ? 's' : ''} logged</div>
          </div>
          <div style="flex:1; padding:8px 14px;">
            <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.6px; color:#94a3b8; margin-bottom:2px;">Date Generated</div>
            <div style="font-size:11px; font-weight:600; color:#1e293b;">${generatedDate}</div>
          </div>
        </div>
        <div style="font-size:11px; font-weight:700; color:#2563eb; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:6px; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">Daily Accomplishments</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
          <thead>
            <tr style="background:#2563eb;">
              <th style="width:20%; color:#fff; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; padding:8px 10px; text-align:left;">Date</th>
              <th style="width:48%; color:#fff; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; padding:8px 10px; text-align:left;">Tasks / Accomplishments</th>
              <th style="width:32%; color:#fff; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; padding:8px 10px; text-align:left;">Reflections &amp; Learnings</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      const style1 = document.createElement('style');
      style1.textContent = `
        #__pdf-page1 table tbody tr { border-bottom:1px solid #e2e8f0; }
        #__pdf-page1 table tbody tr:nth-child(even) { background:#f8fafc; }
        #__pdf-page1 table tbody td { padding:8px 10px; vertical-align:top; line-height:1.5; }
        #__pdf-page1 .date-day  { font-weight:700; font-size:10px; color:#2563eb; }
        #__pdf-page1 .date-full { font-size:9px; color:#64748b; margin-top:2px; }
      `;
      page1.prepend(style1);
      document.body.appendChild(page1);

      Swal.fire({ title: 'Generating PDF…', html: '<p style="font-size:13px;color:#6b7280;">Please wait while your report is being prepared.</p>', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
      await new Promise(r => setTimeout(r, 200));

      const canvas1 = await html2canvas(page1, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: '#ffffff', logging: false,
        width: 794, height: page1.scrollHeight, windowWidth: 794
      });

      const A4_W = 210; const A4_H = 297;
      const MARGIN_TOP = 15; const MARGIN_BOT = 5;
      const CONTENT_H  = A4_H - MARGIN_TOP - MARGIN_BOT;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

      const addCanvasWithMargins = (canvas: HTMLCanvasElement, isFirstPage: boolean) => {
        const pxPerMm = canvas.width / A4_W;
        const slicePx = Math.round(CONTENT_H * pxPerMm);
        const mTopPx  = Math.round(MARGIN_TOP * pxPerMm);
        let srcY = 0; let first = isFirstPage;
        while (srcY < canvas.height) {
          if (!first) pdf.addPage();
          first = false;
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width  = canvas.width;
          pageCanvas.height = Math.round(A4_H * pxPerMm);
          const ctx = pageCanvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          const srcH = Math.min(slicePx, canvas.height - srcY);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, mTopPx, canvas.width, srcH);
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, A4_W, A4_H);
          srcY += srcH;
        }
      };

      addCanvasWithMargins(canvas1, true);

      if (allPhotoItems.length > 0) {
        const photoRowsHtml = (() => {
          let html = '';
          for (let i = 0; i < allPhotoItems.length; i += 2) {
            const a = allPhotoItems[i];
            const b = allPhotoItems[i + 1];
            html += `<div style="display:flex;gap:14px;margin-bottom:14px;align-items:flex-start;">`;
            html += `<div style="flex:1;min-width:0;"><img src="${a.b64}" style="width:100%;border-radius:6px;border:1px solid #e2e8f0;display:block;max-height:200px;object-fit:cover;"><div style="font-size:9px;color:#2563eb;font-weight:600;margin-top:4px;">${a.entryDate}</div><div style="font-size:8px;color:#94a3b8;margin-top:1px;">${a.name}</div>${a.uploadedAt ? `<div style="font-size:8px;color:#c4b5fd;margin-top:1px;">⏱ ${a.uploadedAt}</div>` : ''}</div>`;
            if (b) { html += `<div style="flex:1;min-width:0;"><img src="${b.b64}" style="width:100%;border-radius:6px;border:1px solid #e2e8f0;display:block;max-height:200px;object-fit:cover;"><div style="font-size:9px;color:#2563eb;font-weight:600;margin-top:4px;">${b.entryDate}</div><div style="font-size:8px;color:#94a3b8;margin-top:1px;">${b.name}</div>${b.uploadedAt ? `<div style="font-size:8px;color:#c4b5fd;margin-top:1px;">⏱ ${b.uploadedAt}</div>` : ''}</div>`; }
            else { html += `<div style="flex:1;"></div>`; }
            html += `</div>`;
          }
          return html;
        })();

        const page2 = document.createElement('div');
        page2.id = '__pdf-page2';
        page2.style.cssText = 'position:fixed;left:-9999px;top:0;width:714px;background:#fff;font-family:"Segoe UI",Arial,sans-serif;font-size:11px;color:#1a1a2e;padding:20px 40px 20px 40px;box-sizing:border-box;';
        page2.innerHTML = `<div style="text-align:center; border-bottom:2px solid #2563eb; padding-bottom:10px; margin-bottom:14px;"><div style="font-size:13px; font-weight:700; color:#1e293b;">Photo Evidence</div><div style="font-size:10px; color:#64748b; margin-top:2px;">Visual documentation of daily OJT activities</div></div>${photoRowsHtml}`;
        document.body.appendChild(page2);

        const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false, width: 714, height: page2.scrollHeight, windowWidth: 714 });
        addCanvasWithMargins(canvas2, false);
        document.body.removeChild(page2);
      }

      const pageSig = document.createElement('div');
      pageSig.id = '__pdf-pagesig';
      pageSig.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:"Segoe UI",Arial,sans-serif;font-size:11px;color:#1a1a2e;padding:20px 60px 20px 60px;box-sizing:border-box;';
      pageSig.innerHTML = `
        <div style="text-align:center; border-bottom:2px solid #2563eb; padding-bottom:12px; margin-bottom:40px;">
          <div style="font-size:13px; font-weight:700; color:#1e293b;">Certification &amp; Approval</div>
          <div style="font-size:10px; color:#64748b; margin-top:2px;">Authorized signatories for this accomplishment report</div>
        </div>
        <div style="display:flex; justify-content:space-between; gap:80px; margin-bottom:60px;">
          <div style="flex:1; text-align:center;"><div style="height:48px; border-bottom:1.5px solid #1e293b; margin-bottom:8px;"></div><div style="font-size:11px; font-weight:700; color:#1e293b;">OJT Supervisor</div><div style="font-size:9px; color:#64748b; margin-top:3px;">Immediate Supervisor</div></div>
          <div style="flex:1; text-align:center;"><div style="height:48px; border-bottom:1.5px solid #1e293b; margin-bottom:8px;"></div><div style="font-size:11px; font-weight:700; color:#1e293b;">OCES Admin</div><div style="font-size:9px; color:#64748b; margin-top:3px;">School OJT Coordinator</div></div>
        </div>
        <div style="margin-top:32px; padding-top:10px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:9px; color:#94a3b8;">Generated on ${generatedDate} &nbsp;·&nbsp; Confidential – For Official Use Only</div>
          <div style="font-size:9px; color:#2563eb; font-weight:600;">OJTify · Olongapo City Elementary School</div>
        </div>`;
      document.body.appendChild(pageSig);

      const canvasSig = await html2canvas(pageSig, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false, width: 794, height: pageSig.scrollHeight, windowWidth: 794 });
      addCanvasWithMargins(canvasSig, false);
      document.body.removeChild(pageSig);
      document.body.removeChild(page1);

      const fileName = `OJT-Logbook-${this.currentUserName.replace(/\s+/g, '-')}-${this.reportWeekStart}.pdf`;
      pdf.save(fileName);
      Swal.fire({ icon: 'success', title: 'Downloaded!', text: `Saved as ${fileName}`, confirmButtonColor: '#2563eb', timer: 2500, showConfirmButton: false });

    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Report failed', text: error.message }); }
    finally {
      this.reportGenerating = false;
      document.getElementById('__pdf-page1')?.remove();
      document.getElementById('__pdf-page2')?.remove();
      document.getElementById('__pdf-pagesig')?.remove();
    }
  }

  formatEntryDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }
  get selectedTaskSubmissionScore(): number | null {
  return (this.selectedTask as any)?.submissionScore ?? null;
}
removePendingPhoto(index: number) {
  this.selectedPhotos.splice(index, 1);
}
getSupervisorPhotoUrl(supervisorId: string | undefined): string | null {
  if (!supervisorId) return null;
  const photoId = this.supervisorPhotoMap[supervisorId];
  if (!photoId) return null;
  return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${photoId}/view?project=${this.PROJECT_ID}`;
}
}