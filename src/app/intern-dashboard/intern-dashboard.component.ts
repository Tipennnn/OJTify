import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
import Swal from 'sweetalert2';

interface Task {
  $id?: string;
  title: string;
  description: string;
  posted: string;
  due: string;
  status: 'completed' | 'pending';
}

@Component({
  selector: 'app-intern-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, InternSidenavComponent, InternTopnavComponent],
  templateUrl: './intern-dashboard.component.html',
  styleUrls: ['./intern-dashboard.component.css']
})
export class InternDashboardComponent implements OnInit {

  recentTasks  : Task[] = [];
  tasksLoading = false;
  currentUserId = '';

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    await this.getCurrentUser();
    await this.loadRecentTasks();

    if (sessionStorage.getItem('welcomeShown')) return;

    try {
      const user      = await this.appwrite.account.get();
      const firstName = user.name?.split(' ')[0] || user.email || 'Student';

      sessionStorage.setItem('welcomeShown', 'true');

      Swal.fire({
        icon: 'success',
        title: `Welcome back, ${firstName}!`,
        text: 'You have successfully logged in.',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } catch {
      // No active session, auth guard will handle redirect
    }
  }

  async getCurrentUser() {
    try {
      const user        = await this.appwrite.account.get();
      this.currentUserId = user.$id;
    } catch { }
  }

  async loadRecentTasks() {
    this.tasksLoading = true;
    try {
      const res      = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL
      );

      const allTasks = res.documents as any[];

      // Filter tasks assigned to this user
      const myTasks = allTasks.filter(task => {
        if (!task.assigned_intern_ids) return false;
        const ids = task.assigned_intern_ids
          .split(',')
          .map((id: string) => id.trim());
        return ids.includes(this.currentUserId);
      });

      // Sort by most recent ($createdAt) and take only 3
      this.recentTasks = myTasks
        .sort((a, b) =>
          new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
        )
        .slice(0, 3);

    } catch (error: any) {
      console.error('Failed to load tasks:', error.message);
    } finally {
      this.tasksLoading = false;
    }
  }
}