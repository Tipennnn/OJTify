import { Component, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service';

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
    private router   : Router,
    private appwrite : AppwriteService
  ) {}

  toggleNav(): void {
    this.isCollapsed = !this.isCollapsed;
    this.toggle.emit(this.isCollapsed);
  }

  async onLogout(): Promise<void> {
    try {
      await this.appwrite.account.deleteSession('current');
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      this.router.navigate(['/login']);
    }
  }
}