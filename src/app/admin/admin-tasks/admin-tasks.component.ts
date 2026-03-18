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

  isModalOpen = false;
  selectedTask: Task | null = null;
  selectedFile: File | null = null;
  newComment = '';

  tasks: Task[] = [
    { title:'Create Weekly Report', description:'Submit a detailed weekly report of your internship activities.', posted:'July 20, 2026 • 9:30 AM', due:'July 25, 2026 • 5:00 PM', status:'completed' },
    { title:'Update Company Database', description:'Update employee records with the new HR data.', posted:'July 18, 2026 • 11:15 AM', due:'July 23, 2026 • 4:30 PM', status:'pending' },
    { title:'Prepare Presentation', description:'Create slides for the weekly intern presentation meeting.', posted:'July 19, 2026 • 2:45 PM', due:'July 24, 2026 • 10:00 AM', status:'pending' }
  ];

  openModal() {
    // Open modal for creating a new task
    this.selectedTask = {
      title: '',
      description: '',
      posted: new Date().toLocaleString(),
      due: '',
      status: 'pending'
    };
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedTask = null;
    this.selectedFile = null;
  }

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
