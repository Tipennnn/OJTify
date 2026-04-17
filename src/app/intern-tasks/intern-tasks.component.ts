import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
import { ID } from 'appwrite';
import Swal from 'sweetalert2';

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
  profile_photo_id?: string;
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
  internPhotoMap: { [userId: string]: string } = {};

  currentUserId   = '';
  currentUserName = '';

  readonly BUCKET_ID = '69baaf64002ceb2490df';

  // ── Digital Logbook State ─────────────────────────────────
  activeTab: 'tasks' | 'logbook' = 'tasks';

  // Logbook list
  logbookEntries : LogbookEntry[] = [];
  logbookLoading = false;

  // Logbook entry modal
  isLogbookModalOpen   = false;
  logbookModalMode     : 'add' | 'view' = 'add';
  selectedLogbookEntry : LogbookEntry | null = null;

  // New / edit entry form
  logbookForm = {
    entry_date : '',
    tasks_done : '',
    reflection : ''
  };
  logbookSaving = false;

  // Photos for selected entry
  logbookPhotos  : LogbookPhoto[] = [];
  selectedPhoto  : File | null    = null;
  photoUploading = false;

  // Weekly report
  reportGenerating = false;
  reportWeekStart  = '';
  reportWeekEnd    = '';

  // ── Photo counts per entry ────────────────────────────────
  entryPhotoCounts: Record<string, number> = {};

  // ── Edit comment state ────────────────────────────────────
  editingCommentId: string | null = null;
  editingMessage   = '';

  constructor(private appwrite: AppwriteService) {}

async ngOnInit() {
  await this.getCurrentUser();
  await this.loadInternPhotos(); // ← add this
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

  // ── Load tasks assigned to this intern ────────────────────
  async loadTasks() {
    this.loading = true;
    try {
      const [tasksRes, subsRes] = await Promise.all([
        this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.TASKS_COL
        ),
        this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID,
          this.appwrite.SUBMISSIONS_COL
        )
      ]);

      const allTasks = tasksRes.documents as any[];
      const allSubs  = subsRes.documents as any[];

      const mySubmittedTaskIds = new Set(
        allSubs
          .filter(s => s.student_id === this.currentUserId)
          .map(s => s.task_id)
      );

      this.tasks = allTasks
        .filter(task => {
          if (!task.assigned_intern_ids) return false;
          const ids = task.assigned_intern_ids
            .split(',')
            .map((id: string) => id.trim());
          return ids.includes(this.currentUserId);
        })
        .map(task => ({
          ...task,
          status: mySubmittedTaskIds.has(task.$id) ? 'completed' : 'pending'
        }));

    } catch (error: any) {
      console.error('Failed to load tasks:', error.message);
    } finally {
      this.loading = false;
    }
  }

  // ── Load submissions for selected task ────────────────────
  async loadSubmissions(taskId: string) {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUBMISSIONS_COL
      );

      const all = res.documents as any[];
      this.submissions = all.filter(s =>
        s.task_id === taskId &&
        s.student_id === this.currentUserId
      );
    } catch (error: any) {
      console.error('Failed to load submissions:', error.message);
    }
  }

  // ── Load comments for selected task ──────────────────────
  async loadComments(taskId: string) {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.COMMENTS_COL
      );

      const all = res.documents as any[];
      this.comments = all
        .filter(c => c.task_id === taskId)
        .sort((a, b) =>
          new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime()
        );
    } catch (error: any) {
      console.error('Failed to load comments:', error.message);
    }
  }

  // ── Send comment ──────────────────────────────────────────
  async sendComment() {
    if (!this.newComment.trim() || !this.selectedTask?.$id) return;

    this.commentLoading = true;

    try {
      const doc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.COMMENTS_COL,
        ID.unique(),
        {
          task_id    : this.selectedTask.$id,
          user_id    : this.currentUserId,
          user_name  : this.currentUserName,
          role       : 'intern',
          message    : this.newComment.trim(),
          created_at : new Date().toLocaleString()
        }
      );

      this.comments.push(doc as any);
      this.newComment = '';

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to send comment', text: error.message });
    } finally {
      this.commentLoading = false;
    }
  }

  // ── Edit comment ──────────────────────────────────────────
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
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.COMMENTS_COL,
        comment.$id!,
        { message: this.editingMessage.trim() }
      );

      const index = this.comments.findIndex(c => c.$id === comment.$id);
      if (index !== -1) {
        this.comments[index] = { ...this.comments[index], message: this.editingMessage.trim() };
      }

      this.cancelEdit();

      Swal.fire({
        icon: 'success', title: 'Comment updated!',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 2000, timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to update', text: error.message });
    }
  }

  async deleteComment(comment: Comment) {
    const result = await Swal.fire({
      title: 'Delete comment?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await this.appwrite.databases.deleteDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.COMMENTS_COL,
        comment.$id!
      );

      this.comments = this.comments.filter(c => c.$id !== comment.$id);

      Swal.fire({
        icon: 'success', title: 'Comment deleted!',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 2000, timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message });
    }
  }

  // ── File handling ─────────────────────────────────────────
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.selectedFile = file;
  }

  getFileSize(size: number): string {
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(0) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ── Submit task file ──────────────────────────────────────
  async submitFile() {
    if (!this.selectedFile) {
      Swal.fire({
        icon: 'warning', title: 'No file selected',
        text: 'Please choose a file to submit.', confirmButtonColor: '#3b82f6'
      });
      return;
    }

    if (!this.selectedTask?.$id) return;

    this.submitLoading = true;

    try {
      const uploaded = await this.appwrite.storage.createFile(
        this.BUCKET_ID, ID.unique(), this.selectedFile
      );

      const submission = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUBMISSIONS_COL,
        ID.unique(),
        {
          task_id      : this.selectedTask.$id,
          student_id   : this.currentUserId,
          file_id      : uploaded.$id,
          file_name    : this.selectedFile.name,
          submitted_at : new Date().toLocaleString()
        }
      );

      this.submissions.unshift(submission as any);
      this.selectedFile = null;

      this.selectedTask.status = 'completed';
      const index = this.tasks.findIndex(t => t.$id === this.selectedTask?.$id);
      if (index !== -1) this.tasks[index].status = 'completed';

      Swal.fire({
        icon: 'success', title: 'Submitted!',
        text: 'Your file has been submitted successfully.',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 3000, timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Submission Failed', text: error.message });
    } finally {
      this.submitLoading = false;
    }
  }

  // ── Delete submission ─────────────────────────────────────
  async deleteSubmission(submission: Submission) {
    const result = await Swal.fire({
      title: 'Remove submission?',
      text: 'This will permanently delete your submitted file.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await this.appwrite.storage.deleteFile(this.BUCKET_ID, submission.file_id);

      await this.appwrite.databases.deleteDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUBMISSIONS_COL,
        submission.$id!
      );

      this.submissions = this.submissions.filter(s => s.$id !== submission.$id);

      if (this.submissions.length === 0) {
        this.selectedTask!.status = 'pending';
        const index = this.tasks.findIndex(t => t.$id === this.selectedTask?.$id);
        if (index !== -1) this.tasks[index].status = 'pending';
      }

      Swal.fire({
        icon: 'success', title: 'Removed!',
        text: 'Your submission has been deleted.',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 3000, timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message });
    }
  }

  // ── View submitted file ───────────────────────────────────
  viewFile(fileId: string) {
    const url = `https://sgp.cloud.appwrite.io/v1/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=69ba8d9c0027d10c447f`;
    window.open(url, '_blank');
  }

  // ── Modal controls ────────────────────────────────────────
  async openModal(task: Task) {
    this.selectedTask  = task;
    this.selectedFile  = null;
    this.comments      = [];
    this.submissions   = [];
    this.newComment    = '';
    this.isModalOpen   = true;

    if (task.$id) {
      await Promise.all([
        this.loadSubmissions(task.$id),
        this.loadComments(task.$id)
      ]);
    }
  }

  closeModal() {
    this.isModalOpen  = false;
    this.selectedTask = null;
    this.selectedFile = null;
    this.comments     = [];
    this.submissions  = [];
    this.newComment   = '';
  }
<<<<<<< HEAD
  getInitials(fullName: string): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}
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

getCommentPhotoUrl(userId: string): string | null {
  const photoId = this.internPhotoMap[userId];
  if (!photoId) return null;
  return `https://sgp.cloud.appwrite.io/v1/storage/buckets/${this.BUCKET_ID}/files/${photoId}/view?project=69ba8d9c0027d10c447f`;
}

=======

  // ════════════════════════════════════════════════════════
  //  DIGITAL LOGBOOK METHODS
  // ════════════════════════════════════════════════════════

  switchTab(tab: 'tasks' | 'logbook') {
    this.activeTab = tab;
    if (tab === 'logbook' && this.logbookEntries.length === 0) {
      this.loadLogbookEntries().then(() => this.loadAllPhotoCounts());
    }
  }

  // ── Load all logbook entries for this intern ──────────────
  async loadLogbookEntries() {
    this.logbookLoading = true;
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        'logbook_entries'
      );

      const all = res.documents as any[];
      this.logbookEntries = all
        .filter(e => e.student_id === this.currentUserId)
        .sort((a, b) =>
          new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
        );
    } catch (error: any) {
      console.error('Failed to load logbook:', error.message);
    } finally {
      this.logbookLoading = false;
    }
  }

  // ── Load photo counts for all entries ────────────────────
  async loadAllPhotoCounts() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        'logbook_photos'
      );
      const all  = res.documents as any[];
      const mine = all.filter(p => p.student_id === this.currentUserId);
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

  // ── Stats helpers ─────────────────────────────────────────
  getTotalPhotos(): number {
    return Object.values(this.entryPhotoCounts).reduce((a, b) => a + b, 0);
  }

  getThisWeekCount(): number {
    const now   = new Date();
    const day   = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    start.setHours(0, 0, 0, 0);
    return this.logbookEntries.filter(e => new Date(e.entry_date) >= start).length;
  }

  getCurrentStreak(): number {
    if (this.logbookEntries.length === 0) return 0;
    const sorted = [...this.logbookEntries]
      .map(e => new Date(e.entry_date).toDateString())
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const unique = [...new Set(sorted)];
    let streak = 0;
    const check = new Date();
    check.setHours(0, 0, 0, 0);
    for (const d of unique) {
      const cd = new Date(d);
      cd.setHours(0, 0, 0, 0);
      if (cd.getTime() === check.getTime()) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  // ── Card helpers ──────────────────────────────────────────
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

  // ── Group entries by week ──────────────────────────────────
  getGroupedEntries(): { label: string; range: string; entries: LogbookEntry[] }[] {
    if (this.logbookEntries.length === 0) return [];

    const groups: Record<string, { label: string; range: string; entries: LogbookEntry[] }> = {};

    const getWeekKey = (date: Date): string => {
      const d   = new Date(date);
      const day = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      return mon.toISOString().split('T')[0];
    };

    const fmtShort = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const now     = new Date();
    const thisKey = getWeekKey(now);
    const lastD   = new Date(now);
    lastD.setDate(now.getDate() - 7);
    const lastKey = getWeekKey(lastD);

    for (const entry of this.logbookEntries) {
      const d   = new Date(entry.entry_date);
      const key = getWeekKey(d);

      if (!groups[key]) {
        const monDate = new Date(key);
        const friDate = new Date(key);
        friDate.setDate(monDate.getDate() + 4);

        let label: string;
        if (key === thisKey)      label = 'This week';
        else if (key === lastKey) label = 'Last week';
        else                      label = 'Earlier';

        groups[key] = {
          label,
          range: `${fmtShort(monDate)} – ${fmtShort(friDate)}`,
          entries: []
        };
      }

      groups[key].entries.push(entry);
    }

    return Object.values(groups);
  }

  // ── Open logbook modal for adding new entry ───────────────
  openAddLogbook() {
    this.logbookModalMode     = 'add';
    this.selectedLogbookEntry = null;
    this.logbookPhotos        = [];
    this.selectedPhoto        = null;
    const today = new Date().toISOString().split('T')[0];
    this.logbookForm = { entry_date: today, tasks_done: '', reflection: '' };
    this.isLogbookModalOpen = true;
  }

  // ── Open logbook modal to view existing entry ─────────────
  async openViewLogbook(entry: LogbookEntry) {
    this.logbookModalMode     = 'view';
    this.selectedLogbookEntry = entry;
    this.logbookForm = {
      entry_date : entry.entry_date,
      tasks_done : entry.tasks_done,
      reflection : entry.reflection
    };
    this.logbookPhotos  = [];
    this.selectedPhoto  = null;
    this.isLogbookModalOpen = true;

    if (entry.$id) {
      await this.loadLogbookPhotos(entry.$id);
    }
  }

  closeLogbookModal() {
    this.isLogbookModalOpen   = false;
    this.selectedLogbookEntry = null;
    this.logbookPhotos        = [];
    this.selectedPhoto        = null;
  }

  // ── Save new logbook entry ────────────────────────────────
  async saveLogbookEntry() {
    if (!this.logbookForm.entry_date || !this.logbookForm.tasks_done.trim()) {
      Swal.fire({
        icon: 'warning', title: 'Incomplete Entry',
        text: 'Please fill in the date and tasks done.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    this.logbookSaving = true;

    try {
      const doc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        'logbook_entries',
        ID.unique(),
        {
          student_id   : this.currentUserId,
          student_name : this.currentUserName,
          entry_date   : this.logbookForm.entry_date,
          tasks_done   : this.logbookForm.tasks_done.trim(),
          reflection   : this.logbookForm.reflection.trim(),
          created_at   : new Date().toLocaleString()
        }
      );

      this.logbookEntries.unshift(doc as any);

      if (this.selectedPhoto && doc.$id) {
        await this.uploadLogbookPhoto(doc.$id, this.selectedPhoto);
      }

      // Update photo counts
      if (this.selectedPhoto) {
        this.entryPhotoCounts[doc.$id] = 1;
      }

      this.closeLogbookModal();

      Swal.fire({
        icon: 'success', title: 'Entry Saved!',
        text: 'Your daily logbook entry has been recorded.',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 3000, timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to save entry', text: error.message });
    } finally {
      this.logbookSaving = false;
    }
  }

  // ── Delete logbook entry ──────────────────────────────────
  async deleteLogbookEntry(entry: LogbookEntry) {
    const result = await Swal.fire({
      title: 'Delete this entry?',
      text: 'This will permanently delete the logbook entry and its photos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await this.appwrite.databases.deleteDocument(
        this.appwrite.DATABASE_ID,
        'logbook_entries',
        entry.$id!
      );

      this.logbookEntries = this.logbookEntries.filter(e => e.$id !== entry.$id);
      if (entry.$id) delete this.entryPhotoCounts[entry.$id];

      Swal.fire({
        icon: 'success', title: 'Deleted!',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 2000, timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message });
    }
  }

  // ── Photo handling ────────────────────────────────────────
  onPhotoSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.selectedPhoto = file;
  }

  async uploadLogbookPhoto(entryId: string, file: File) {
    this.photoUploading = true;
    try {
      const uploaded = await this.appwrite.storage.createFile(
        this.BUCKET_ID, ID.unique(), file
      );

      const photoDoc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        'logbook_photos',
        ID.unique(),
        {
          entry_id    : entryId,
          student_id  : this.currentUserId,
          file_id     : uploaded.$id,
          file_name   : file.name,
          uploaded_at : new Date().toLocaleString()
        }
      );

      this.logbookPhotos.push(photoDoc as any);
      this.selectedPhoto = null;

      // Update count
      this.entryPhotoCounts[entryId] = (this.entryPhotoCounts[entryId] || 0) + 1;

      Swal.fire({
        icon: 'success', title: 'Photo uploaded!',
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 2000, timerProgressBar: true
      });

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
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        'logbook_photos'
      );

      const all = res.documents as any[];
      this.logbookPhotos = all.filter(p => p.entry_id === entryId);
    } catch (error: any) {
      console.error('Failed to load photos:', error.message);
    }
  }

  async deleteLogbookPhoto(photo: LogbookPhoto) {
    const result = await Swal.fire({
      title: 'Delete this photo?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await this.appwrite.storage.deleteFile(this.BUCKET_ID, photo.file_id);
      await this.appwrite.databases.deleteDocument(
        this.appwrite.DATABASE_ID,
        'logbook_photos',
        photo.$id!
      );
      this.logbookPhotos = this.logbookPhotos.filter(p => p.$id !== photo.$id);

      // Decrement count
      if (photo.entry_id && this.entryPhotoCounts[photo.entry_id]) {
        this.entryPhotoCounts[photo.entry_id]--;
      }

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to delete photo', text: error.message });
    }
  }

  getPhotoUrl(fileId: string): string {
    return `https://sgp.cloud.appwrite.io/v1/storage/buckets/${this.BUCKET_ID}/files/${fileId}/view?project=69ba8d9c0027d10c447f`;
  }

  // ── Weekly Report Export (PDF via print) ──────────────────
  async generateWeeklyReport() {
    if (!this.reportWeekStart || !this.reportWeekEnd) {
      Swal.fire({
        icon: 'warning', title: 'Select a date range',
        text: 'Please enter the week start and end dates.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    this.reportGenerating = true;

    try {
      const start = new Date(this.reportWeekStart);
      const end   = new Date(this.reportWeekEnd);

      const weekEntries = this.logbookEntries.filter(e => {
        const d = new Date(e.entry_date);
        return d >= start && d <= end;
      });

      if (weekEntries.length === 0) {
        Swal.fire({
          icon: 'info', title: 'No entries found',
          text: 'There are no logbook entries for the selected week.',
          confirmButtonColor: '#2563eb'
        });
        this.reportGenerating = false;
        return;
      }

      const rows = weekEntries
        .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())
        .map(e => `
          <tr>
            <td>${new Date(e.entry_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
            <td style="white-space:pre-wrap;">${e.tasks_done}</td>
            <td style="white-space:pre-wrap;">${e.reflection || '—'}</td>
          </tr>
        `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Weekly OJT Report</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 13px; padding: 40px; color: #111; }
            h1   { text-align: center; font-size: 18px; margin-bottom: 4px; }
            .sub { text-align: center; font-size: 13px; color: #555; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 10px 12px; vertical-align: top; text-align: left; }
            th { background: #1e40af; color: white; font-size: 13px; }
            tr:nth-child(even) { background: #f3f4f6; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; }
            .sig-line { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 4px; font-size: 12px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>Weekly OJT Accomplishment Report</h1>
          <p class="sub">
            Intern: <strong>${this.currentUserName}</strong> &nbsp;|&nbsp;
            Week: <strong>${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
          </p>
          <table>
            <thead>
              <tr>
                <th style="width:25%">Date</th>
                <th style="width:45%">Tasks / Accomplishments</th>
                <th style="width:30%">Reflections</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">
            <div>
              <div class="sig-line">${this.currentUserName}</div>
              <div style="font-size:11px;text-align:center;margin-top:4px;">OJT Intern</div>
            </div>
            <div>
              <div class="sig-line">_______________________</div>
              <div style="font-size:11px;text-align:center;margin-top:4px;">OJT Coordinator / Supervisor</div>
            </div>
          </div>
        </body>
        </html>
      `;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
      }

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Report failed', text: error.message });
    } finally {
      this.reportGenerating = false;
    }
  }

  // ── Helper: format entry date for display ─────────────────
  formatEntryDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday : 'short',
      year    : 'numeric',
      month   : 'short',
      day     : 'numeric'
    });
  }
>>>>>>> ab63c9b7b183a241ca8bae5a85b69300e4f7b95e
}