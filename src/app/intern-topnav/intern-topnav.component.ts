import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
selector: 'app-intern-topnav',
standalone: true,
imports: [CommonModule],
templateUrl: './intern-topnav.component.html',
styleUrls: ['./intern-topnav.component.css']
})

export class InternTopnavComponent {

menuOpen = false;
showPasswordModal = false;

showCurrent = false;
showNew = false;
showConfirm = false;

constructor(private router: Router) {}

toggleMenu() {
this.menuOpen = !this.menuOpen;
}

goProfile() {
this.router.navigate(['/intern-profile']);
this.menuOpen = false;
}

openChangePassword() {
this.showPasswordModal = true;
this.menuOpen = false;
}

closeModal() {
this.showPasswordModal = false;
}

logout() {
this.router.navigate(['/intern-login']);
}

updatePassword(){
console.log("Password Updated");
this.showPasswordModal = false;
}

get greeting(): string {
const hour = new Date().getHours();

if (hour < 12) return "Good Morning, Intern!";
else if (hour < 18) return "Good Afternoon, Intern!";
else return "Good Evening, Intern!";
}

}
