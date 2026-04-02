import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-supervisor-sidenav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './supervisor-sidenav.component.html',
  styleUrls: ['./supervisor-sidenav.component.css']
})
export class SupervisorSidenavComponent {
  isCollapsed = false;

  toggleNav(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  onLogout(): void {
    console.log('Logout clicked');
    // lagyan mo ng actual logout logic later
  }
}