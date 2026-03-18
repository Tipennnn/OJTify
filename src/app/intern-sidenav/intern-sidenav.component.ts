import { Component, HostListener } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AppwriteService } from '../services/appwrite.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-intern-sidenav',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './intern-sidenav.component.html',
  styleUrls: ['./intern-sidenav.component.css']
})
export class InternSidenavComponent {
  isCollapsed = false;

  constructor(
    private router: Router,
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

  toggleNav() {
    this.isCollapsed = !this.isCollapsed;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.isCollapsed = event.target.innerWidth < 768;
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

    sessionStorage.removeItem('welcomeShown');
    sessionStorage.setItem('loggedOut', 'true');
    this.router.navigate(['/intern-login']);
  }
}