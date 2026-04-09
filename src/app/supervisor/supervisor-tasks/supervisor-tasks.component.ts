import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupervisorSidenavComponent } from '../supervisor-sidenav/supervisor-sidenav.component';
import { SupervisorTopnavComponent } from '../supervisor-topnav/supervisor-topnav.component';

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
  selector: 'app-supervisor-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SupervisorSidenavComponent,
    SupervisorTopnavComponent
  ],
  templateUrl: './supervisor-tasks.component.html',
  styleUrls: ['./supervisor-tasks.component.css']
})
export class SupervisorTasksComponent implements OnInit {

  isModalOpen            = false;
  isCardModalOpen        = false;
  isSubmissionsModalOpen = false;
  loading                = false;
  editAttachmentLoading  = false;
  isCollapsed            = false;

  newSupervisorComment = '';
  taskComments        : any[] = [];
  taskSubmissions     : any[] = [];

  editingCommentId : string | null = null;
  editingMessage                   = '';

  tasks          : Task[]   = [];
  allInterns     : Intern[] = [];
  filteredInterns: Intern[] = [];
  selectedInterns: Intern[] = [];
  internSearchQuery = '';
  assignMode: 'all' | 'specific' = 'specific';

  selectedTask       : Task        = this.emptyTask();
  selectedFile       : File | null = null;
  attachmentFileName               = '';

  editAttachmentFile    : File | null = null;
  editAttachmentFileName              = '';

  /* ─── PAGINATION ─── */
  currentPage = 1;
  pageSize    = 5;

  get totalPages(): number {
    return Math.ceil(this.tasks.length / this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get pagedTasks(): Task[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.tasks.slice(start, start + this.pageSize);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  /* ─── COUNTS ─── */
  get assignedCount(): number {
    return this.getAssignedIds(this.selectedTask).length;
  }

  get pendingCount(): number {
    const diff = this.assignedCount - this.taskSubmissions.length;
    return diff < 0 ? 0 : diff;
  }

  ngOnInit() {
    this.seedDummyData();
  }

  /* ══════════════════════════════════════════
     DUMMY DATA
  ══════════════════════════════════════════ */
  seedDummyData() {

    this.allInterns = [
      { $id: 'i1', first_name: 'Maria',    last_name: 'Santos',    course: 'BSCS' },
      { $id: 'i2', first_name: 'Juan',     last_name: 'Dela Cruz',  course: 'BSIT' },
      { $id: 'i3', first_name: 'Angela',   last_name: 'Reyes',      course: 'BSCS' },
      { $id: 'i4', first_name: 'Carlo',    last_name: 'Mendoza',    course: 'BSIT' },
      { $id: 'i5', first_name: 'Patricia', last_name: 'Lim',        course: 'BSCS' },
      { $id: 'i6', first_name: 'Kevin',    last_name: 'Tan',        course: 'BSIT' },
      { $id: 'i7', first_name: 'Denise',   last_name: 'Garcia',     course: 'BSCS' },
      { $id: 'i8', first_name: 'Marco',    last_name: 'Villanueva', course: 'BSIT' },
    ];
    this.filteredInterns = [...this.allInterns];

    this.tasks = [
      {
        $id: 't1',
        title: 'Weekly Progress Report',
        description: 'Submit a detailed weekly progress report covering all tasks completed, challenges encountered, and goals for the upcoming week. Minimum 500 words.',
        posted: '4/1/2026, 8:00 AM',
        due: '2026-04-07',
        status: 'pending',
        assigned_intern_ids: 'i1,i2,i3,i4,i5,i6,i7,i8',
        attachment_file_id: 'dummy_file_1',
        attachment_file_name: 'report-template.docx',
      },
      {
        $id: 't2',
        title: 'UI/UX Case Study',
        description: 'Conduct a UI/UX case study on a mobile application of your choice. Identify usability issues and propose redesign solutions with wireframes.',
        posted: '4/2/2026, 9:30 AM',
        due: '2026-04-14',
        status: 'pending',
        assigned_intern_ids: 'i1,i3,i5,i7',
        attachment_file_id: '',
        attachment_file_name: '',
      },
      {
        $id: 't3',
        title: 'Database Design Task',
        description: 'Design an Entity-Relationship Diagram (ERD) for a hospital management system. Include at least 8 entities with proper relationships and cardinalities.',
        posted: '4/3/2026, 10:00 AM',
        due: '2026-04-10',
        status: 'pending',
        assigned_intern_ids: 'i2,i4,i6,i8',
        attachment_file_id: 'dummy_file_2',
        attachment_file_name: 'erd-guidelines.pdf',
      },
      {
        $id: 't4',
        title: 'API Integration Exercise',
        description: 'Integrate a public REST API (e.g. OpenWeatherMap or JSONPlaceholder) into a simple web app. Document the endpoints used and provide screenshots.',
        posted: '4/4/2026, 11:15 AM',
        due: '2026-04-18',
        status: 'pending',
        assigned_intern_ids: 'i1,i2,i3,i4,i5,i6,i7,i8',
        attachment_file_id: '',
        attachment_file_name: '',
      },
      {
        $id: 't5',
        title: 'Internship Reflection Essay',
        description: 'Write a reflective essay (800–1000 words) on your internship experience so far. Discuss skills gained, lessons learned, and career aspirations.',
        posted: '4/5/2026, 8:45 AM',
        due: '2026-04-21',
        status: 'pending',
        assigned_intern_ids: 'i1,i2,i3,i4,i5,i6,i7,i8',
        attachment_file_id: '',
        attachment_file_name: '',
      },
      {
        $id: 't6',
        title: 'Agile Sprint Planning',
        description: 'Create a mock sprint plan for a 2-week development sprint. Define user stories, acceptance criteria, story points, and assign tasks to team members.',
        posted: '4/6/2026, 9:00 AM',
        due: '2026-04-20',
        status: 'pending',
        assigned_intern_ids: 'i3,i4,i5,i6',
        attachment_file_id: 'dummy_file_3',
        attachment_file_name: 'agile-template.xlsx',
      },
      {
        $id: 't7',
        title: 'System Architecture Diagram',
        description: 'Create a detailed system architecture diagram for a cloud-based e-commerce platform. Include front-end, back-end, database, and third-party services.',
        posted: '4/7/2026, 10:30 AM',
        due: '2026-04-25',
        status: 'pending',
        assigned_intern_ids: 'i1,i2,i5,i6,i7,i8',
        attachment_file_id: '',
        attachment_file_name: '',
      },
    ];
  }

  /* ══════════════════════════════════════════
     DUMMY COMMENTS & SUBMISSIONS PER TASK
  ══════════════════════════════════════════ */
  getDummyComments(taskId: string): any[] {
    const map: Record<string, any[]> = {
      't1': [
        { $id: 'c1', task_id: 't1', user_id: 'sup1', user_name: 'Supervisor Rivera', role: 'supervisor', message: 'Please use the provided template for your report. Make sure all sections are filled in.', created_at: '4/1/2026, 9:00 AM' },
        { $id: 'c2', task_id: 't1', user_id: 'i1',   user_name: 'Maria Santos',       role: 'intern',     message: 'Noted! Will submit by end of the week.', created_at: '4/1/2026, 10:15 AM' },
        { $id: 'c3', task_id: 't1', user_id: 'i2',   user_name: 'Juan Dela Cruz',     role: 'intern',     message: 'Got it. Quick question — does the word count include the title and headers?', created_at: '4/2/2026, 8:30 AM' },
        { $id: 'c4', task_id: 't1', user_id: 'sup1', user_name: 'Supervisor Rivera', role: 'supervisor', message: 'No, the 500-word minimum is for body text only.', created_at: '4/2/2026, 9:00 AM' },
      ],
      't2': [
        { $id: 'c5', task_id: 't2', user_id: 'sup1', user_name: 'Supervisor Rivera', role: 'supervisor', message: 'You may choose any popular mobile app — Shopee, Grab, or GCash are great options.', created_at: '4/2/2026, 10:00 AM' },
        { $id: 'c6', task_id: 't2', user_id: 'i3',   user_name: 'Angela Reyes',      role: 'intern',     message: 'I will be analyzing GCash. Looking forward to this task!', created_at: '4/3/2026, 7:45 AM' },
      ],
      't3': [
        {
          $id: 'c7',
          task_id: 't3',
          user_id: 'sup1',
          user_name: 'Supervisor Rivera',
          role: 'supervisor',
          message: `Refer to the attached guidelines for the expected ERD format. Use crow's foot notation.`,
          created_at: '4/3/2026, 10:30 AM'
        },
      ],
      't4': [],
      't5': [
        { $id: 'c8', task_id: 't5', user_id: 'sup1', user_name: 'Supervisor Rivera', role: 'supervisor', message: 'Be honest and specific in your reflection. Generic essays will be returned for revision.', created_at: '4/5/2026, 9:00 AM' },
        { $id: 'c9', task_id: 't5', user_id: 'i5',   user_name: 'Patricia Lim',      role: 'intern',     message: 'Understood! Will make it personal and detailed.', created_at: '4/5/2026, 11:20 AM' },
      ],
      't6': [],
      't7': [
        { $id: 'c10', task_id: 't7', user_id: 'sup1', user_name: 'Supervisor Rivera', role: 'supervisor', message: 'Use draw.io or Lucidchart for the diagram. Export as PNG or PDF.', created_at: '4/7/2026, 11:00 AM' },
      ],
    };
    return map[taskId] ?? [];
  }

  getDummySubmissions(taskId: string): any[] {
    const map: Record<string, any[]> = {
      't1': [
        { file_id: 'f1', file_name: 'weekly-report-maria.pdf',   student_name: 'Maria Santos',    student_id: 'i1', submitted_at: '4/6/2026, 11:00 AM' },
        { file_id: 'f2', file_name: 'progress-report-juan.docx', student_name: 'Juan Dela Cruz',  student_id: 'i2', submitted_at: '4/6/2026, 2:30 PM'  },
        { file_id: 'f3', file_name: 'report-angela.pdf',         student_name: 'Angela Reyes',    student_id: 'i3', submitted_at: '4/7/2026, 8:15 AM'  },
      ],
      't2': [
        { file_id: 'f4', file_name: 'ux-casestudy-angela.pdf',   student_name: 'Angela Reyes',    student_id: 'i3', submitted_at: '4/13/2026, 4:00 PM' },
      ],
      't3': [
        { file_id: 'f5', file_name: 'erd-carlo.png',             student_name: 'Carlo Mendoza',   student_id: 'i4', submitted_at: '4/9/2026, 9:00 AM'  },
        { file_id: 'f6', file_name: 'hospital-erd-kevin.pdf',    student_name: 'Kevin Tan',        student_id: 'i6', submitted_at: '4/9/2026, 3:45 PM'  },
      ],
      't4': [],
      't5': [
        { file_id: 'f7', file_name: 'reflection-patricia.docx',  student_name: 'Patricia Lim',    student_id: 'i5', submitted_at: '4/20/2026, 10:00 AM' },
        { file_id: 'f8', file_name: 'essay-marco.pdf',           student_name: 'Marco Villanueva', student_id: 'i8', submitted_at: '4/20/2026, 11:30 AM' },
        { file_id: 'f9', file_name: 'reflection-denise.docx',    student_name: 'Denise Garcia',    student_id: 'i7', submitted_at: '4/21/2026, 7:50 AM'  },
      ],
      't6': [
        { file_id: 'f10', file_name: 'sprint-plan-angela.xlsx',  student_name: 'Angela Reyes',    student_id: 'i3', submitted_at: '4/19/2026, 1:00 PM'  },
      ],
      't7': [],
    };
    return map[taskId] ?? [];
  }

  /* ══════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════ */
  emptyTask(): Task {
    return {
      title: '', description: '',
      posted: new Date().toLocaleString(),
      due: '', status: 'pending',
      assigned_intern_ids: '',
      attachment_file_id: '',
      attachment_file_name: '',
      assignedInterns: [], comments: [], submissions: []
    };
  }

  getAssignedIds(task: Task): string[] {
    if (!task.assigned_intern_ids) return [];
    return task.assigned_intern_ids.split(',').filter(id => id.trim());
  }

  getInternName(id: string): string {
    const intern = this.allInterns.find(i => i.$id === id);
    return intern ? `${intern.first_name} ${intern.last_name}` : id;
  }

  getInitials(fullName: string): string {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const last  = parts[parts.length - 1]?.[0] ?? '';
    return (first + last).toUpperCase();
  }

  onInternSearch() {
    const q = this.internSearchQuery.toLowerCase();
    this.filteredInterns = this.allInterns.filter(i =>
      `${i.first_name} ${i.last_name}`.toLowerCase().includes(q)
    );
  }

  onToggleSidebar(collapsed: boolean) {
    this.isCollapsed = collapsed;
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

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    this.selectedFile       = file;
    this.attachmentFileName = file?.name ?? '';
  }

  onEditFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    this.editAttachmentFile     = file;
    this.editAttachmentFileName = file?.name ?? '';
  }

  /* ══════════════════════════════════════════
     MODAL OPEN/CLOSE
  ══════════════════════════════════════════ */
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
    const assignedIds      = this.getAssignedIds(task);
    const assignedInterns  = assignedIds.map(id => {
      const intern = this.allInterns.find(i => i.$id === id);
      return { name: intern ? `${intern.first_name} ${intern.last_name}` : id, img: '' };
    });

    this.selectedTask           = { ...task, assignedInterns, comments: [], submissions: [] };
    this.editAttachmentFile     = null;
    this.editAttachmentFileName = '';
    this.newSupervisorComment   = '';
    this.editingCommentId       = null;
    this.editingMessage         = '';

    this.taskComments    = task.$id ? this.getDummyComments(task.$id)    : [];
    this.taskSubmissions = task.$id ? this.getDummySubmissions(task.$id) : [];

    this.isCardModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeCardModal() {
    this.isCardModalOpen        = false;
    this.editAttachmentFile     = null;
    this.editAttachmentFileName = '';
    this.newSupervisorComment   = '';
    this.taskComments           = [];
    this.taskSubmissions        = [];
    this.editingCommentId       = null;
    this.editingMessage         = '';
    document.body.style.overflow = '';
  }

  openSubmissionsModal()  { this.isSubmissionsModalOpen = true;  }
  closeSubmissionsModal() { this.isSubmissionsModalOpen = false; }

  /* ══════════════════════════════════════════
     CREATE TASK (dummy — no backend)
  ══════════════════════════════════════════ */
  onCreateTask() {
    if (!this.selectedTask.title || !this.selectedTask.due) {
      alert('Please fill in the title and due date.');
      return;
    }
    this.loading = true;

    setTimeout(() => {
      const newTask: Task = {
        $id: 't' + Date.now(),
        title:               this.selectedTask.title,
        description:         this.selectedTask.description,
        posted:              new Date().toLocaleString(),
        due:                 this.selectedTask.due,
        status:              'pending',
        assigned_intern_ids: this.assignMode === 'all'
          ? this.allInterns.map(i => i.$id).join(',')
          : this.selectedInterns.map(i => i.$id).join(','),
        attachment_file_id:   this.selectedFile ? 'local_' + Date.now() : '',
        attachment_file_name: this.selectedFile?.name ?? '',
      };

      this.tasks.unshift(newTask);
      this.currentPage = 1;
      this.closeModal();
      this.loading = false;
    }, 600);
  }

  /* ══════════════════════════════════════════
     ATTACHMENT (dummy — no backend)
  ══════════════════════════════════════════ */
  uploadEditAttachment() {
    if (!this.editAttachmentFile) return;
    this.editAttachmentLoading = true;

    setTimeout(() => {
      this.selectedTask.attachment_file_id   = 'local_' + Date.now();
      this.selectedTask.attachment_file_name = this.editAttachmentFile!.name;

      const index = this.tasks.findIndex(t => t.$id === this.selectedTask.$id);
      if (index !== -1) {
        this.tasks[index].attachment_file_id   = this.selectedTask.attachment_file_id;
        this.tasks[index].attachment_file_name = this.selectedTask.attachment_file_name;
      }

      this.editAttachmentFile     = null;
      this.editAttachmentFileName = '';
      this.editAttachmentLoading  = false;
    }, 500);
  }

  removeAttachment() {
    if (!confirm('Remove this attachment?')) return;
    this.selectedTask.attachment_file_id   = '';
    this.selectedTask.attachment_file_name = '';

    const index = this.tasks.findIndex(t => t.$id === this.selectedTask.$id);
    if (index !== -1) {
      this.tasks[index].attachment_file_id   = '';
      this.tasks[index].attachment_file_name = '';
    }
    this.editAttachmentFile     = null;
    this.editAttachmentFileName = '';
  }

  /* ══════════════════════════════════════════
     COMMENTS (dummy — no backend)
  ══════════════════════════════════════════ */
  sendSupervisorComment() {
    if (!this.newSupervisorComment.trim()) return;

    const newComment = {
      $id:        'c' + Date.now(),
      task_id:    this.selectedTask.$id,
      user_id:    'sup1',
      user_name:  'Supervisor Rivera',
      role:       'supervisor',
      message:    this.newSupervisorComment.trim(),
      created_at: new Date().toLocaleString()
    };

    this.taskComments.push(newComment);
    this.newSupervisorComment = '';
  }

  startEditComment(comment: any) {
    this.editingCommentId = comment.$id;
    this.editingMessage   = comment.message;
  }

  cancelEditComment() {
    this.editingCommentId = null;
    this.editingMessage   = '';
  }

  saveEditComment(comment: any) {
    if (!this.editingMessage.trim()) return;
    const index = this.taskComments.findIndex(c => c.$id === comment.$id);
    if (index !== -1) {
      this.taskComments[index] = {
        ...this.taskComments[index],
        message: this.editingMessage.trim()
      };
    }
    this.cancelEditComment();
  }

  deleteSupervisorComment(comment: any) {
    if (!confirm('Delete this comment?')) return;
    this.taskComments = this.taskComments.filter(c => c.$id !== comment.$id);
  }

  /* ══════════════════════════════════════════
     DELETE TASK (dummy — no backend)
  ══════════════════════════════════════════ */
  deleteTask(task: Task, event: Event) {
    event.stopPropagation();
    if (!confirm(`Delete "${task.title}"?`)) return;
    this.tasks = this.tasks.filter(t => t.$id !== task.$id);
    if (this.isCardModalOpen) this.closeCardModal();
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
  }
}