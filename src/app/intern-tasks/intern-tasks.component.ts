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

  isModalOpen   = false;
  selectedTask  : Task | null = null;
  selectedFile  : File | null = null;
  newComment    = '';
  loading       = false;
  submitLoading = false;
  commentLoading = false;
  

  tasks      : Task[]       = [];
  comments   : Comment[]    = [];
  submissions: Submission[] = [];

currentUserId   = '';
currentUserName = '';

  readonly BUCKET_ID = '69baaf64002ceb2490df';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.getCurrentUser();
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
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL
      );

      const allTasks = res.documents as any[];

      this.tasks = allTasks.filter(task => {
        if (!task.assigned_intern_ids) return false;
        const ids = task.assigned_intern_ids
          .split(',')
          .map((id: string) => id.trim());
        return ids.includes(this.currentUserId);
      });

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
          task_id:    this.selectedTask.$id,
          user_id:    this.currentUserId,
          user_name:  this.currentUserName,
          role:       'intern',
          message:    this.newComment.trim(),
          created_at: new Date().toLocaleString()
        }
      );

      this.comments.push(doc as any);
      this.newComment = '';

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to send comment',
        text: error.message
      });
    } finally {
      this.commentLoading = false;
    }
  }

  // ── Edit comment ──────────────────────────────────────────
    editingCommentId: string | null = null;
    editingMessage   = '';

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

    // Update locally
    const index = this.comments.findIndex(c => c.$id === comment.$id);
    if (index !== -1) {
      this.comments[index] = {
        ...this.comments[index],
        message: this.editingMessage.trim()
      };
    }

    this.cancelEdit();

    Swal.fire({
      icon: 'success',
      title: 'Comment updated!',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
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
      icon: 'success',
      title: 'Comment deleted!',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
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
        icon: 'warning',
        title: 'No file selected',
        text: 'Please choose a file to submit.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    if (!this.selectedTask?.$id) return;

    this.submitLoading = true;

    try {
      const uploaded = await this.appwrite.storage.createFile(
        this.BUCKET_ID,
        ID.unique(),
        this.selectedFile
      );

      const submission = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUBMISSIONS_COL,
        ID.unique(),
        {
          task_id:      this.selectedTask.$id,
          student_id:   this.currentUserId,
          file_id:      uploaded.$id,
          file_name:    this.selectedFile.name,
          submitted_at: new Date().toLocaleString()
        }
      );

      this.submissions.unshift(submission as any);
      this.selectedFile = null;

      Swal.fire({
        icon: 'success',
        title: 'Submitted!',
        text: 'Your file has been submitted successfully.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: error.message
      });
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
      await this.appwrite.storage.deleteFile(
        this.BUCKET_ID,
        submission.file_id
      );

      await this.appwrite.databases.deleteDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.SUBMISSIONS_COL,
        submission.$id!
      );

      this.submissions = this.submissions.filter(s => s.$id !== submission.$id);

      Swal.fire({
        icon: 'success',
        title: 'Removed!',
        text: 'Your submission has been deleted.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to delete',
        text: error.message
      });
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
}