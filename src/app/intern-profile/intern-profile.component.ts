import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
selector: 'app-intern-profile',
standalone: true,
imports: [],
templateUrl: './intern-profile.component.html',
styleUrl: './intern-profile.component.css'
})

export class InternProfileComponent {

constructor(private router: Router){}

goDashboard(){
this.router.navigate(['/intern-dashboard']);
}

}