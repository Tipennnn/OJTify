import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';  // <-- import RouterModule

@Component({
  selector: 'app-intern-register',
  standalone: true,
  imports: [CommonModule, RouterModule],  // <-- add RouterModule here
  templateUrl: './intern-register.component.html',
  styleUrls: ['./intern-register.component.css']  // <-- fixed property name
})
export class InternRegisterComponent {}