import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { AppwriteService } from '../services/appwrite.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-intern-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, InternSidenavComponent, InternTopnavComponent],
  templateUrl: './intern-dashboard.component.html',
  styleUrls: ['./intern-dashboard.component.css']
})
export class InternDashboardComponent implements OnInit {

  constructor(private appwrite: AppwriteService) {}

  async ngOnInit() {
    if (sessionStorage.getItem('welcomeShown')) return;

    try {
      const user = await this.appwrite.account.get();
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
}