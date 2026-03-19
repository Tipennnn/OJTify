import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
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

  recentTasks      : Task[] = [];
  tasksLoading     = false;
  currentUserId    = '';
  profileIncomplete = false;

  constructor(
    private appwrite: AppwriteService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.getCurrentUser();

    // Run all in parallel — don't wait for each one
    this.loadRecentTasks();

    // Check profile and show alerts together
    await this.checkAndShowAlerts();
  }

  async getCurrentUser() {
    try {
      const user        = await this.appwrite.account.get();
      this.currentUserId = user.$id;
    } catch { }
  }

  // ── Check profile & show alerts ───────────────────────────
  async checkAndShowAlerts() {
    try {
      const user = await this.appwrite.account.get();
      const firstName = user.name?.split(' ')[0] || user.email || 'Student';

      // Check profile completeness
      const res  = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.STUDENTS_COL
      );
      const docs = res.documents as any[];
      const doc  = docs.find(d => d.$id === this.currentUserId);

      // Find what's missing
      const missingFields: string[] = [];
      if (doc) {
        if (!doc.profile_photo_id?.trim()) missingFields.push('Profile photo');
        if (!doc.contact_number?.trim())   missingFields.push('Contact number');
        if (!doc.home_address?.trim())     missingFields.push('Home address');
      }

      this.profileIncomplete = missingFields.length > 0;

      // Show welcome toast first (only on first login)
      if (!sessionStorage.getItem('welcomeShown')) {
        sessionStorage.setItem('welcomeShown', 'true');

        await Swal.fire({
          icon: 'success',
          title: `Welcome back, ${firstName}!`,
          text: 'You have successfully logged in.',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
      }

      // Show profile alert after welcome (only once per session)
      if (this.profileIncomplete && !sessionStorage.getItem('profileAlertShown')) {
        sessionStorage.setItem('profileAlertShown', 'true');

        const missingText = missingFields.join(', ');

        const result = await Swal.fire({
          icon: 'warning',
          title: 'Profile Incomplete!',
          html: `Please complete the following in your profile:<br><br>
                 <b style="color:#d97706;">${missingText}</b>`,
          showCancelButton: true,
          confirmButtonText: 'Complete Now',
          cancelButtonText: 'Later',
          confirmButtonColor: '#d97706',
          cancelButtonColor: '#6b7280',
        });

        if (result.isConfirmed) {
          this.router.navigate(['/intern-profile']);
        }
      }

    } catch {
      // No active session
    }
  }

  async loadRecentTasks() {
    this.tasksLoading = true;
    try {
      const res      = await this.appwrite.databases.listDocuments(
        this.appwrite.DATABASE_ID,
        this.appwrite.TASKS_COL
      );

      const allTasks = res.documents as any[];

      const myTasks = allTasks.filter(task => {
        if (!task.assigned_intern_ids) return false;
        const ids = task.assigned_intern_ids
          .split(',')
          .map((id: string) => id.trim());
        return ids.includes(this.currentUserId);
      });

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