import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';

interface Task {
  title: string;
  description: string;
  posted: string;
  due: string;
  status: 'completed' | 'pending';
}

interface Comment {
  name: string;
  message: string;
  date: string;
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
export class InternTasksComponent {

  /* ================================
     MODAL STATE
  ================================== */

  isModalOpen = false;
  selectedTask: Task | null = null;

  /* ================================
     FILE UPLOAD
  ================================== */

  selectedFile: File | null = null;

  onFileSelected(event: any) {

    const file = event.target.files[0];

    if (file) {
      this.selectedFile = file;
    }

  }

  removeFile() {
    this.selectedFile = null;
  }

  submitFile() {

    if (!this.selectedFile) {
      alert('Please choose a file first.');
      return;
    }

    alert(`File "${this.selectedFile.name}" submitted successfully!`);

    this.selectedFile = null;

  }

  getFileSize(size: number): string {

    if (size < 1024) return size + ' B';

    if (size < 1024 * 1024)
      return (size / 1024).toFixed(0) + ' KB';

    return (size / (1024 * 1024)).toFixed(1) + ' MB';

  }

  /* ================================
     COMMENTS
  ================================== */

  newComment = '';

  comments: Comment[] = [
    {
      name: 'Michael Santos',
      message: 'Good start! Please complete the remaining sections.',
      date: 'March 2, 2026 • 2:30 PM'
    }
  ];

  sendComment() {

    if (!this.newComment.trim()) return;

    this.comments.push({
      name: 'You',
      message: this.newComment,
      date: new Date().toLocaleString()
    });

    this.newComment = '';

  }

  /* ================================
     TASK DATA
  ================================== */

  tasks: Task[] = [
    {
      title: 'Create Weekly Report',
      description: 'Submit a detailed weekly report of your internship activities.',
      posted: 'July 20, 2026 • 9:30 AM',
      due: 'July 25, 2026 • 5:00 PM',
      status: 'completed'
    },
    {
      title: 'Update Company Database',
      description: 'Update employee records with the new HR data.',
      posted: 'July 18, 2026 • 11:15 AM',
      due: 'July 23, 2026 • 4:30 PM',
      status: 'pending'
    },
    {
      title: 'Prepare Presentation',
      description: 'Create slides for the weekly intern presentation meeting.',
      posted: 'July 19, 2026 • 2:45 PM',
      due: 'July 24, 2026 • 10:00 AM',
      status: 'pending'
    }
  ];

  /* ================================
     MODAL CONTROLS
  ================================== */

  openModal(task: Task) {

    this.selectedTask = task;
    this.selectedFile = null;
    this.isModalOpen = true;

  }

  closeModal() {

    this.isModalOpen = false;
    this.selectedTask = null;
    this.selectedFile = null;

  }

}