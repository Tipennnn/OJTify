import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';

interface Task {
  title: string;
  description: string;
  posted: string;
  due: string;
  status: 'completed' | 'pending';
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
export class AdminTasksComponent {

  isModalOpen = false;       // Create Task Modal
  isCardModalOpen = false;   // Task Card Modal

  selectedTask: Task | null = null;
  selectedFile: File | null = null;

  tasks: Task[] = [
    {
      title: 'Create Weekly Report',
      description: 'Submit a detailed weekly report of your internship activities.',
      posted: 'July 20, 2026 • 9:30 AM',
      due: 'July 25, 2026 • 5:00 PM',
      status: 'completed',
      assignedInterns: [
        { name: 'Juan P. Santos', img: 'assets/intern1.png' },
        { name: 'Adrian P. Legua', img: 'assets/intern2.png' }
      ],
      comments: [
        {
          author: 'Juan P. Santos',
          authorImg: 'assets/intern1.png',
          text: 'Good afternoon, Sir!',
          date: 'March 2, 2026, 2:30 pm'
        }
      ],
      submissions: [
        { name: 'Juan P. Santos', img: 'assets/intern1.png', fileName: 'Research.pdf' },
        { name: 'Adrian P. Legua', img: 'assets/intern2.png', fileName: 'Research.pdf' }
      ]
    },
    {
      title: 'Update Company Database',
      description: 'Update employee records with the new HR data.',
      posted: 'July 18, 2026 • 11:15 AM',
      due: 'July 23, 2026 • 4:30 PM',
      status: 'pending',
      assignedInterns: [
        { name: 'Juan P. Santos', img: 'assets/intern1.png' }
      ],
      comments: [],
      submissions: []
    },
    {
      title: 'Prepare Presentation',
      description: 'Create slides for the weekly intern presentation meeting.',
      posted: 'July 19, 2026 • 2:45 PM',
      due: 'July 24, 2026 • 10:00 AM',
      status: 'pending',
      assignedInterns: [
        { name: 'Adrian P. Legua', img: 'assets/intern2.png' }
      ],
      comments: [],
      submissions: []
    }
  ];

  // ---------------- CREATE TASK MODAL ----------------
  openModal() {
    this.selectedTask = {
      title: '',
      description: '',
      posted: new Date().toLocaleString(),
      due: '',
      status: 'pending',
      assignedInterns: [],
      comments: [],
      submissions: []
    };
    this.selectedFile = null;
    this.isModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedTask = null;
    this.selectedFile = null;
    document.body.style.overflow = '';
  }

  // ---------------- CARD MODAL ----------------
  openCardModal(task: Task) {
    this.selectedTask = {
      ...task,
      assignedInterns: task.assignedInterns || [],
      comments: task.comments || [],
      submissions: task.submissions || []
    };
    this.isCardModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeCardModal() {
    this.isCardModalOpen = false;
    this.selectedTask = null;
    document.body.style.overflow = '';
  }

  // ---------------- FILE UPLOAD ----------------
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.selectedFile = file;
  }

  submitFile() {
    if (!this.selectedFile) {
      alert('Please choose a file first.');
      return;
    }
    alert(`File "${this.selectedFile.name}" submitted successfully!`);
    this.selectedFile = null;
  }
}