import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InternSidenavComponent } from '../intern-sidenav/intern-sidenav.component';
import { InternTopnavComponent } from '../intern-topnav/intern-topnav.component';
import { SupabaseService } from '../services/supabase.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-intern-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, InternSidenavComponent, InternTopnavComponent],
  templateUrl: './intern-dashboard.component.html',
  styleUrls: ['./intern-dashboard.component.css']
})
export class InternDashboardComponent implements OnInit {

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    // If alert was already shown this session, skip it
    if (sessionStorage.getItem('welcomeShown')) return;

    const { data: { session } } = await this.supabase.client.auth.getSession();

    if (session?.user) {
      const meta = session.user.user_metadata;
      const firstName = meta['first_name'] || session.user.email || 'Student';

      // Mark as shown BEFORE firing so refreshes won't re-trigger it
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
    }
  }
}