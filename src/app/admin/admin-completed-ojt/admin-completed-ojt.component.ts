import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { AdminTopnavComponent } from '../admin-topnav/admin-topnav.component';

interface Student {
  first_name: string;
  middle_name?: string;
  last_name: string;
  student_id: string;
  email: string;
  ojt_start: string;
  ojt_end: string;
  contact_number?: string;
  birthday?: string;
  gender?: string;
  home_address?: string;
  school_name?: string;
  course?: string;
  year_level?: string;
  required_hours?: number;
  completed_hours?: number;
}

@Component({
  selector: 'app-admin-completed-ojt',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AdminSidenavComponent,
    AdminTopnavComponent
  ],
  templateUrl: './admin-completed-ojt.component.html',
  styleUrls: ['./admin-completed-ojt.component.css']
})
export class AdminCompletedOjtComponent implements OnInit {

  students: Student[] = [];
  filteredStudents: Student[] = [];
  searchQuery = '';

  years: number[] = [];
  months: string[] = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Modal
  showModal: boolean = false;
  selectedStudent: Student | null = null;

  ngOnInit() {
    this.loadMockStudents();
    this.populateYears();
  }

  loadMockStudents() {
    this.students = [
      { 
        first_name: 'John Ron', middle_name: 'Bautista', last_name: 'Diza',
        student_id: '2313213131', email: 'johnrondiza1106@gmail.com',
        ojt_start: '2026-01-01', ojt_end: '2026-03-20',
        contact_number:'09384718273', birthday:'2014-06-19', gender:'Male', home_address:'43 Arthur St. WBB Olongapo City',
        school_name:'Gordon College', course:'BSIT', year_level:'3rd',
        required_hours: 500, completed_hours: 0
      },
      { 
        first_name: 'Maria', last_name: 'Santos', student_id: 'ST124', email: 'maria@example.com',
        ojt_start: '2026-01-05', ojt_end: '2026-03-18',
        contact_number:'09123456780', birthday:'2004-02-01', gender:'Female', home_address:'456 Street',
        school_name:'XYZ University', course:'CS', year_level:'2nd',
        required_hours: 500, completed_hours: 500
      }
    ];
    this.filteredStudents = [...this.students];
  }

  populateYears() {
    const currentYear = new Date().getFullYear();
    this.years = [];
    for(let i=currentYear; i>=currentYear-5; i--) this.years.push(i);
  }

  onSearch(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.filteredStudents = this.students.filter(s => {
      const fullName = `${s.first_name} ${s.middle_name ?? ''} ${s.last_name}`.toLowerCase();
      return fullName.includes(this.searchQuery) ||
             s.student_id.toLowerCase().includes(this.searchQuery) ||
             s.email.toLowerCase().includes(this.searchQuery);
    });
  }

  getFullName(s: Student | null) {
    if(!s) return '';
    return `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`;
  }

  getStartDate(s: Student | null) {
    if(!s) return '—';
    return new Date(s.ojt_start).toLocaleDateString('en-US');
  }

  getEndDate(s: Student | null) {
    if(!s) return '—';
    return new Date(s.ojt_end).toLocaleDateString('en-US');
  }

  getAvatarUrl(s: Student | null) {
    if(!s) return 'assets/default-avatar.png';
    const initials = `${s.first_name.charAt(0)}${s.last_name.charAt(0)}`;
    return `https://ui-avatars.com/api/?name=${initials}&background=2563eb&color=fff&size=64`;
  }

  getProgress(s: Student | null) {
    if(!s) return 0;
    const req = s.required_hours || 500;
    const comp = s.completed_hours || 0;
    return Math.min(Math.round((comp / req) * 100), 100);
  }

  getRemainingHours(s: Student | null) {
    if(!s) return 0;
    const req = s.required_hours || 500;
    const comp = s.completed_hours || 0;
    return Math.max(req - comp, 0);
  }

  openModal(student: Student) {
    this.selectedStudent = student;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.selectedStudent = null;
  }

}