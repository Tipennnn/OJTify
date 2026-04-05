import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisorOjtProfileComponent } from './supervisor-ojt-profile.component';

describe('SupervisorOjtProfileComponent', () => {
  let component: SupervisorOjtProfileComponent;
  let fixture: ComponentFixture<SupervisorOjtProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisorOjtProfileComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SupervisorOjtProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
