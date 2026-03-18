import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';
import { AppwriteService } from '../../services/appwrite.service';
import { ID } from 'appwrite';
import Swal from 'sweetalert2';

interface Intern {
  $id: string;
  first_name: string;
  last_name: string;
  course: string;
}

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
  assignedInterns?: { name: string; img: string }[];
  comments?: { author: string; authorImg: string; text: string; date: string }[];
  submissions?: { name: string; img: string; fileName: string }[];
}

@Component({
  selector: 'app-admin-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminSidenavComponent,
    AdminTopnavComponent
  ],
  templateUrl: './admin-tasks.component.html',
  styleUrls: ['./admin-tasks.component.css']
})
export class AdminTasksComponent implements OnInit {

  isModalOpen     = false;
  isCardModalOpen = false;
  loading         = false;
  attachmentLoading = false;
  // Add these properties
newAdminComment    = '';
adminCommentLoading = false;
taskComments   : any[] = [];
taskSubmissions: any[] = [];

  tasks          : Task[]   = [];
  allInterns     : Intern[] = [];
  filteredInterns: Intern[] = [];
  selectedInterns: Intern[] = [];
  internSearchQuery = '';
  assignMode: 'all' | 'specific' = 'specific';

  selectedTask      : Task        = this.emptyTask();
  selectedFile      : File | null = null;
  attachmentFileName              = '';

  // For editing attachment in card modal
  editAttachmentFile    : File | null = null;
  editAttachmentFileName              = '';
  editAttachmentLoading               = false;

  readonly BUCKET_ID  = '69baaf64002ceb2490df';
  readonly PROJECT_ID = '69ba8d9c0027d10c447f';
  readonly ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.loadInterns();
    await this.loadTasks();
  }

  emptyTask(): Task {
    return {
      title: '',
      description: '',
      posted: new Date().toLocaleString(),
      due: '',
      status: 'pending',
      assigned_intern_ids: '',
      attachment_file_id: '',
      attachment_file_name: '',
      assignedInterns: [],
      comments: [],
      submissions: []
    };
  }

  // ── Load interns ──────────────────────────────────────────
  async loadInterns() {
    try {
      const res = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      this.allInterns      = res.documents as any[];
      this.filteredInterns = [...this.allInterns];
    } catch (error: any) {
      console.error('Failed to load interns:', error.message);
    }
  }

  // ── Load tasks ────────────────────────────────────────────
  async loadTasks() {
    try {
      const res      = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL
      );
      const allTasks = res.documents as any[];
      const existingInternIds = new Set(this.allInterns.map(i => i.$id));

      const validTasks   : any[] = [];
      const orphanedTasks: any[] = [];

      for (const task of allTasks) {
        if (!task.assigned_intern_ids) {
          validTasks.push(task);
          continue;
        }

        const assignedIds = task.assigned_intern_ids
          .split(',')
          .map((id: string) => id.trim())
          .filter((id: string) => id);

        const stillExistingIds = assignedIds.filter((id: string) =>
          existingInternIds.has(id)
        );

        if (stillExistingIds.length === 0 && assignedIds.length > 0) {
          orphanedTasks.push(task);
        } else {
          if (stillExistingIds.length !== assignedIds.length) {
            await this.appwrite.databases.updateDocument(
              this.appwrite.DATABASE_ID,
              this.appwrite.TASKS_COL,
              task.$id,
              { assigned_intern_ids: stillExistingIds.join(',') }
            );
            task.assigned_intern_ids = stillExistingIds.join(',');
          }
          validTasks.push(task);
        }
      }

      for (const task of orphanedTasks) {
        try {
          if (task.attachment_file_id) {
            await this.appwrite.storage.deleteFile(this.BUCKET_ID, task.attachment_file_id);
          }
          await this.appwrite.databases.deleteDocument(
            this.appwrite.DATABASE_ID,
            this.appwrite.TASKS_COL,
            task.$id
          );
        } catch { }
      }

      this.tasks = validTasks;
    } catch (error: any) {
      console.error('Failed to load tasks:', error.message);
    }
  }

  // ── Intern search & selection ─────────────────────────────
  onInternSearch() {
    const q = this.internSearchQuery.toLowerCase();
    this.filteredInterns = this.allInterns.filter(i =>
      `${i.first_name} ${i.last_name}`.toLowerCase().includes(q)
    );
  }

  isSelected(intern: Intern): boolean {
    return this.selectedInterns.some(i => i.$id === intern.$id);
  }

  toggleIntern(intern: Intern) {
    if (this.isSelected(intern)) {
      this.selectedInterns = this.selectedInterns.filter(i => i.$id !== intern.$id);
    } else {
      this.selectedInterns.push(intern);
    }
  }

  // ── File selection (create modal) ─────────────────────────
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    this.selectedFile       = file;
    this.attachmentFileName = file?.name ?? '';
  }

  // ── File selection (edit attachment in card modal) ────────
  onEditFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    this.editAttachmentFile     = file;
    this.editAttachmentFileName = file?.name ?? '';
  }

  // ── Upload new attachment for existing task ───────────────
  async uploadEditAttachment() {
    if (!this.editAttachmentFile || !this.selectedTask.$id) return;

    this.editAttachmentLoading = true;

    try {
      // 1. Delete old file if exists
      if (this.selectedTask.attachment_file_id) {
        try {
          await this.appwrite.storage.deleteFile(
            this.BUCKET_ID,
            this.selectedTask.attachment_file_id
          );
        } catch { }
      }

      // 2. Upload new file
      const uploaded = await this.appwrite.storage.createFile(
        this.BUCKET_ID,
        ID.unique(),
        this.editAttachmentFile
      );

      // 3. Update task document
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL,
        this.selectedTask.$id,
        {
          attachment_file_id:   uploaded.$id,
          attachment_file_name: this.editAttachmentFile.name
        }
      );

      // 4. Update local state
      this.selectedTask.attachment_file_id   = uploaded.$id;
      this.selectedTask.attachment_file_name = this.editAttachmentFile.name;

      // Update in tasks list too
      const index = this.tasks.findIndex(t => t.$id === this.selectedTask.$id);
      if (index !== -1) {
        this.tasks[index].attachment_file_id   = uploaded.$id;
        this.tasks[index].attachment_file_name = this.editAttachmentFile.name;
      }

      this.editAttachmentFile     = null;
      this.editAttachmentFileName = '';

      Swal.fire({
        icon: 'success',
        title: 'Attachment Updated!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Upload Failed', text: error.message });
    } finally {
      this.editAttachmentLoading = false;
    }
  }

  // ── Remove attachment from existing task ──────────────────
  async removeAttachment() {
    if (!this.selectedTask.attachment_file_id || !this.selectedTask.$id) return;

    const result = await Swal.fire({
      title: 'Remove attachment?',
      text: 'This will permanently delete the attached file.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      // 1. Delete from storage
      await this.appwrite.storage.deleteFile(
        this.BUCKET_ID,
        this.selectedTask.attachment_file_id
      );

      // 2. Clear from task document
      await this.appwrite.databases.updateDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL,
        this.selectedTask.$id,
        {
          attachment_file_id:   '',
          attachment_file_name: ''
        }
      );

      // 3. Update local state
      this.selectedTask.attachment_file_id   = '';
      this.selectedTask.attachment_file_name = '';

      // Update in tasks list too
      const index = this.tasks.findIndex(t => t.$id === this.selectedTask.$id);
      if (index !== -1) {
        this.tasks[index].attachment_file_id   = '';
        this.tasks[index].attachment_file_name = '';
      }

      this.editAttachmentFile     = null;
      this.editAttachmentFileName = '';

      Swal.fire({
        icon: 'success',
        title: 'Attachment Removed!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to remove', text: error.message });
    }
  }

  // ── Open/close modals ─────────────────────────────────────
  openModal() {
    this.selectedTask       = this.emptyTask();
    this.selectedFile       = null;
    this.attachmentFileName = '';
    this.selectedInterns    = [];
    this.internSearchQuery  = '';
    this.filteredInterns    = [...this.allInterns];
    this.assignMode         = 'specific';
    this.isModalOpen        = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.isModalOpen = false;
    document.body.style.overflow = '';
  }

 openCardModal(task: Task) {
  const assignedIds = this.getAssignedIds(task);
  const assignedInterns = assignedIds.map(id => {
    const intern = this.allInterns.find(i => i.$id === id);
    return {
      name: intern ? `${intern.first_name} ${intern.last_name}` : id,
      img: 'assets/intern1.png'
    };
  });

  this.selectedTask = {
    ...task,
    assignedInterns,
    comments:    [],
    submissions: []
  };

  this.editAttachmentFile     = null;
  this.editAttachmentFileName = '';
  this.newAdminComment        = '';
  this.taskComments           = [];
  this.taskSubmissions        = [];
  this.isCardModalOpen        = true;
  document.body.style.overflow = 'hidden';

  if (task.$id) {
    this.loadTaskComments(task.$id);
    this.loadTaskSubmissions(task.$id);
  }
}

 closeCardModal() {
  this.isCardModalOpen        = false;
  this.editAttachmentFile     = null;
  this.editAttachmentFileName = '';
  this.newAdminComment        = '';
  this.taskComments           = [];
  this.taskSubmissions        = [];
  document.body.style.overflow = '';
}

  // ── Create task ───────────────────────────────────────────
  async onCreateTask() {
    if (!this.selectedTask.title || !this.selectedTask.due) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing fields',
        text: 'Please fill in the title and due date.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    this.loading = true;

    try {
      let attachmentFileId = '';
      if (this.selectedFile) {
        const uploaded = await this.appwrite.storage.createFile(
          this.BUCKET_ID, ID.unique(), this.selectedFile
        );
        attachmentFileId = uploaded.$id;
      }

      let assignedIds = '';
      if (this.assignMode === 'all') {
        assignedIds = this.allInterns.map(i => i.$id).join(',');
      } else {
        assignedIds = this.selectedInterns.map(i => i.$id).join(',');
      }

      const doc = await this.appwrite.databases.createDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL,
        ID.unique(),
        {
          title:                this.selectedTask.title,
          description:          this.selectedTask.description,
          posted:               new Date().toLocaleString(),
          due:                  this.selectedTask.due,
          status:               'pending',
          assigned_intern_ids:  assignedIds,
          attachment_file_id:   attachmentFileId,
          attachment_file_name: this.selectedFile?.name ?? ''
        }
      );

      this.tasks.unshift(doc as any);
      this.closeModal();

      Swal.fire({
        icon: 'success',
        title: 'Task Created!',
        text: `"${doc['title']}" has been created successfully.`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed', text: error.message });
    } finally {
      this.loading = false;
    }
  }

  // ── Delete task ───────────────────────────────────────────
  async deleteTask(task: Task, event: Event) {
    event.stopPropagation();

    const result = await Swal.fire({
      title: 'Delete task?',
      text: `"${task.title}" will be permanently deleted.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      if (task.attachment_file_id) {
        try {
          await this.appwrite.storage.deleteFile(this.BUCKET_ID, task.attachment_file_id);
        } catch { }
      }

      await this.appwrite.databases.deleteDocument(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL,
        task.$id!
      );

      this.tasks = this.tasks.filter(t => t.$id !== task.$id);
      if (this.isCardModalOpen) this.closeCardModal();

      Swal.fire({
        icon: 'success',
        title: 'Task Deleted!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed to delete', text: error.message });
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  getFileUrl(fileId: string, mode: 'view' | 'download' = 'view'): string {
    return `${this.ENDPOINT}/storage/buckets/${this.BUCKET_ID}/files/${fileId}/${mode}?project=${this.PROJECT_ID}`;
  }

  getAssignedIds(task: Task): string[] {
    if (!task.assigned_intern_ids) return [];
    return task.assigned_intern_ids.split(',').filter(id => id.trim());
  }

  getInternName(id: string): string {
    const intern = this.allInterns.find(i => i.$id === id);
    return intern ? `${intern.first_name} ${intern.last_name}` : id;
  }

  // ── Load comments for task (admin view) ───────────────────
async loadTaskComments(taskId: string) {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.COMMENTS_COL
    );
    const all = res.documents as any[];
    this.taskComments = all
      .filter(c => c.task_id === taskId)
      .sort((a, b) =>
        new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime()
      );
  } catch (error: any) {
    console.error('Failed to load comments:', error.message);
  }
}

// ── Load submissions for task (admin view) ────────────────
async loadTaskSubmissions(taskId: string) {
  try {
    const res = await this.appwrite.databases.listDocuments(
      this.appwrite.DATABASE_ID,
      this.appwrite.SUBMISSIONS_COL
    );
    const all = res.documents as any[];
    const taskSubs = all.filter(s => s.task_id === taskId);

    // Attach student name to each submission
    this.taskSubmissions = taskSubs.map(sub => {
      const intern = this.allInterns.find(i => i.$id === sub.student_id);
      return {
        ...sub,
        student_name: intern
          ? `${intern.first_name} ${intern.last_name}`
          : 'Unknown'
      };
    });
  } catch (error: any) {
    console.error('Failed to load submissions:', error.message);
  }
}

// ── Send comment as admin ─────────────────────────────────
async sendAdminComment() {
  if (!this.newAdminComment.trim() || !this.selectedTask.$id) return;

  this.adminCommentLoading = true;

  try {
    const user = await this.appwrite.account.get();

    const doc = await this.appwrite.databases.createDocument(
      this.appwrite.DATABASE_ID,
      this.appwrite.COMMENTS_COL,
      ID.unique(),
      {
        task_id:    this.selectedTask.$id,
        user_id:    user.$id,
        user_name:  user.name || user.email || 'Admin',
        role:       'admin',
        message:    this.newAdminComment.trim(),
        created_at: new Date().toLocaleString()
      }
    );

    this.taskComments.push(doc as any);
    this.newAdminComment = '';

  } catch (error: any) {
    Swal.fire({ icon: 'error', title: 'Failed to send', text: error.message });
  } finally {
    this.adminCommentLoading = false;
  }
}
}