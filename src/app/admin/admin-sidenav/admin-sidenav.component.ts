import { Component, HostListener, Output, EventEmitter } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AppwriteService } from '../../services/appwrite.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-sidenav',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './admin-sidenav.component.html',
  styleUrls: ['./admin-sidenav.component.css']
})
export class AdminSidenavComponent {
  isCollapsed = false;
  private manuallyCollapsed = false;

  @Output() toggle = new EventEmitter<boolean>();

  constructor(
    private router: Router,
    private appwrite: AppwriteService
  ) {
    this.isCollapsed = window.innerWidth < 768;
    this.manuallyCollapsed = this.isCollapsed;

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (window.innerWidth < 768) {
          this.isCollapsed = true;
          this.manuallyCollapsed = true;
          this.toggle.emit(this.isCollapsed);
        }
      });
  }

  toggleNav() {
    this.isCollapsed = !this.isCollapsed;
    this.manuallyCollapsed = this.isCollapsed;
    this.toggle.emit(this.isCollapsed);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    const isMobile = event.target.innerWidth < 768;

    if (isMobile) {
      this.isCollapsed = true;
    } else {
      if (!this.manuallyCollapsed) {
        this.isCollapsed = false;
      }
    }

    this.toggle.emit(this.isCollapsed);
  }

  async onLogout() {
    const result = await Swal.fire({
      title: 'Log out?',
      text: 'Are you sure you want to log out?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, log out',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
    });

    if (!result.isConfirmed) return;

    const { error } = await this.appwrite.signOut();

    if (error) {
      Swal.fire({
        icon: 'error',
        title: 'Logout Failed',
        text: (error as any).message,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    sessionStorage.removeItem('adminWelcomeShown');
    sessionStorage.setItem('adminLoggedOut', 'true');
    this.router.navigate(['/admin-login']);
  }
}