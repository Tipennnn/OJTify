import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisorTopnavComponent } from './supervisor-topnav.component';

describe('SupervisorTopnavComponent', () => {
  let component: SupervisorTopnavComponent;
  let fixture: ComponentFixture<SupervisorTopnavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisorTopnavComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SupervisorTopnavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
