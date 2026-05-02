import { Component, HostListener, OnDestroy, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AppwriteService } from '../../services/appwrite.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-supervisor-sidenav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './supervisor-sidenav.component.html',
  styleUrls: ['./supervisor-sidenav.component.css']
})
export class SupervisorSidenavComponent implements OnDestroy {
  isCollapsed = false;
  private isMobile = false;
  private routerSub: Subscription;

  @Output() toggle = new EventEmitter<boolean>();

  constructor(
    private router: Router,
    private appwrite: AppwriteService
  ) {
    this.isMobile = window.innerWidth < 768;
    // Sync [class.collapsed] with what CSS media queries already show on mobile.
    // Previously this was only set inside toggleNav/onResize so on first load
    // on mobile the class was missing — tooltips and label hiding didn't work.
    this.isCollapsed = this.isMobile;

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // On mobile: re-collapse after navigating (in case it was opened)
        if (this.isMobile) {
          this.isCollapsed = true;
          this.toggle.emit(true);
        }
      });
  }

  toggleNav(): void {
    // Works on both mobile and desktop now.
    // On mobile the CSS sets padding/sizing, the class drives show/hide.
    this.isCollapsed = !this.isCollapsed;
    this.toggle.emit(this.isCollapsed);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    const width = event.target.innerWidth;
    const wasMobile = this.isMobile;
    this.isMobile = width < 768;

    // Only auto-adjust when CROSSING the 768px breakpoint.
    // Previously every resize above 768px reset isCollapsed to false,
    // which wiped the user's manual desktop toggle state mid-session.
    if (!wasMobile && this.isMobile) {
      // Crossed into mobile → collapse
      this.isCollapsed = true;
      this.toggle.emit(true);
    } else if (wasMobile && !this.isMobile) {
      // Crossed into desktop → expand
      this.isCollapsed = false;
      this.toggle.emit(false);
    }
  }

  ngOnDestroy(): void {
    // Clean up router subscription to prevent memory leaks.
    // The original component had no OnDestroy at all.
    this.routerSub?.unsubscribe();
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

    this.appwrite.updateProfilePhoto(
      'https://ui-avatars.com/api/?name=User&background=0818A8&color=fff&size=128'
    );

    sessionStorage.removeItem('supervisorWelcomeShown');
    sessionStorage.setItem('supervisorLoggedOut', 'true');
    this.router.navigate(['/supervisor-login']);
  }
}