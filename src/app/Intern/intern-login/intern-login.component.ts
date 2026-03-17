import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-intern-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './intern-login.component.html',
  styleUrls: ['./intern-login.component.css']
})
export class InternLoginComponent implements OnInit {

  email        = '';
  password     = '';
  rememberMe   = false;
  showPassword = false;

  loading      = false;
  errorMessage = '';

  constructor(
    private supabase: SupabaseService,
    private router: Router
  ) {}

  ngOnInit() {
    // Show logged out toast if redirected from logout
    if (sessionStorage.getItem('loggedOut')) {
      sessionStorage.removeItem('loggedOut');

      Swal.fire({
        icon: 'success',
        title: 'Logged out successfully',
        text: 'See you next time!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onLogin() {
    this.errorMessage = '';
    this.loading = true;

    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email:    this.email,
      password: this.password
    });

    this.loading = false;

    if (error) {
      this.errorMessage = 'Invalid email or password. Please try again.';
      return;
    }

    sessionStorage.removeItem('welcomeShown');
    this.router.navigate(['/intern-dashboard']);
  }
}