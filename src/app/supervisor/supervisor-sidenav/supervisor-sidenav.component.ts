import { Component, HostListener, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AppwriteService } from '../../services/appwrite.service';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-supervisor-sidenav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './supervisor-sidenav.component.html',
  styleUrls: ['./supervisor-sidenav.component.css']
})
export class SupervisorSidenavComponent {
  isCollapsed = false;

  @Output() toggle = new EventEmitter<boolean>();

  constructor(
    private router  : Router,
    private appwrite: AppwriteService
  ) {
    this.isCollapsed = window.innerWidth < 768;

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (window.innerWidth < 768) {
          this.isCollapsed = true;
        }
      });
  }

  toggleNav(): void {
    this.isCollapsed = !this.isCollapsed;
    this.toggle.emit(this.isCollapsed);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.isCollapsed = event.target.innerWidth < 768;
  }

  async onLogout(): Promise<void> {
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

    // Reset photo
    this.appwrite.updateProfilePhoto(
      'https://ui-avatars.com/api/?name=User&background=0818A8&color=fff&size=128'
    );

    sessionStorage.removeItem('supervisorWelcomeShown');
    sessionStorage.setItem('supervisorLoggedOut', 'true');
    this.router.navigate(['/supervisor-login']);
  }
}