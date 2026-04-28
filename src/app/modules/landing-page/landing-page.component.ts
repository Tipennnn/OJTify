import { Component, HostListener, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppwriteService } from '../../services/appwrite.service'; // adjust path if needed
import { Query } from 'appwrite';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent implements OnInit, AfterViewInit, OnDestroy {

  isScrolled = false;
  menuOpen   = false;
  activeTab  = 0;
  activeModal: 'privacy' | 'terms' | null = null;

  totalStudents    = 180;
  totalSupervisors = 24;
  totalAdmins      = 6;
  get totalActiveUsers(): number { return this.totalStudents + this.totalSupervisors + this.totalAdmins; }
  beneficiarySchool = 'OCES';

  private animId: number | null = null;
  private resizeHandler: (() => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseX = -9999;
  private mouseY = -9999;

  previewTabs = [
    { label: 'Dashboard',  path: 'dashboard' },
    { label: 'Attendance', path: 'attendance' },
    { label: 'Logbook',    path: 'logbook' }
  ];

  constructor(private router: Router, private appwrite: AppwriteService) {}

  ngOnInit(): void {
    this.loadUserCounts();
  }

  async loadUserCounts() {
    try {
      const [students, supervisors, admins] = await Promise.all([
        this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID, this.appwrite.STUDENTS_COL, [Query.limit(1)]
        ),
        this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID, this.appwrite.SUPERVISORS_COL, [Query.limit(1)]
        ),
        this.appwrite.databases.listDocuments(
          this.appwrite.DATABASE_ID, this.appwrite.ADMINS_COL, [Query.limit(1)]
        ),
      ]);
      this.totalStudents    = students.total;
      this.totalSupervisors = supervisors.total;
      this.totalAdmins      = admins.total;
    } catch (e) {
      // fallback values stay
    }
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }

  openModal(type: 'privacy' | 'terms') { this.activeModal = type; }
  closeModal() { this.activeModal = null; }

  ngAfterViewInit(): void {
    this.initCtaCanvas();
  }

  ngOnDestroy(): void {
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.mouseMoveHandler) window.removeEventListener('mousemove', this.mouseMoveHandler);
  }

  private initCtaCanvas(): void {
    const canvas = document.getElementById('cta-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const section = canvas.closest('.cta-section') as HTMLElement;
    if (!section) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const RAY_COUNT  = 180;
    const REPEL_DIST = 160;
    const REPEL_STR  = 0.55;

    interface Ray {
      baseAngle: number;
      len: number;
      speed: number;
      phase: number;
      hue: number;
      alpha: number;
    }
    let rays: Ray[] = [];

    const buildRays = () => {
      rays = [];
      for (let i = 0; i < RAY_COUNT; i++) {
        rays.push({
          baseAngle: (Math.random() * Math.PI) - Math.PI,
          len:   180 + Math.random() * 340,
          speed: 0.00025 + Math.random() * 0.0005,
          phase: Math.random() * Math.PI * 2,
          hue:   195 + Math.random() * 50,
          alpha: 0.18 + Math.random() * 0.5
        });
      }
    };

    const resize = () => {
      canvas.width  = section.offsetWidth;
      canvas.height = section.offsetHeight;
      buildRays();
    };

    this.mouseMoveHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    };
    window.addEventListener('mousemove', this.mouseMoveHandler);

    const draw = (ts: number) => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H + 80;

      for (const r of rays) {
        const wobble = Math.sin(ts * r.speed + r.phase) * 0.045;
        let angle = r.baseAngle + wobble;

        const innerR = 32 + Math.sin(ts * r.speed * 0.7 + r.phase) * 12;
        const tipX   = cx + Math.cos(angle) * (innerR + r.len);
        const tipY   = cy + Math.sin(angle) * (innerR + r.len);
        const dx     = tipX - this.mouseX;
        const dy     = tipY - this.mouseY;
        const dist   = Math.sqrt(dx * dx + dy * dy);

        if (dist < REPEL_DIST && this.mouseX > -500) {
          const influence = (1 - dist / REPEL_DIST);
          const mouseAngle = Math.atan2(this.mouseY - cy, this.mouseX - cx);
          const diff = angle - mouseAngle;
          const norm = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          angle += (norm > 0 ? 1 : -1) * influence * REPEL_STR;
        }

        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * (innerR + r.len);
        const y2 = cy + Math.sin(angle) * (innerR + r.len);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `hsla(${r.hue}, 100%, 82%, ${r.alpha * 0.45})`;
        ctx.lineWidth   = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x2, y2, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${r.hue}, 100%, 92%, ${r.alpha})`;
        ctx.fill();
      }

      this.animId = requestAnimationFrame(draw);
    };

    this.resizeHandler = resize;
    window.addEventListener('resize', this.resizeHandler);
    resize();
    this.animId = requestAnimationFrame(draw);
  }

  @HostListener('window:scroll', [])
  onWindowScroll() { this.isScrolled = window.scrollY > 40; }

  toggleMenu() { this.menuOpen = !this.menuOpen; }
  closeMenu()  { this.menuOpen = false; }

  scrollTo(sectionId: string) {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.menuOpen = false;
  }
}