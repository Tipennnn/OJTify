import { Component, HostListener } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-intern-sidenav',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './intern-sidenav.component.html',
  styleUrls: ['./intern-sidenav.component.css']
})
export class InternSidenavComponent {
  isCollapsed = false;

  constructor(private router: Router) {
    // Collapse by default on mobile/tablet
    this.isCollapsed = window.innerWidth < 768;

    // Auto collapse after navigation on mobile/tablet
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
}