import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisorAttendanceComponent } from './supervisor-attendance.component';

describe('SupervisorAttendanceComponent', () => {
  let component: SupervisorAttendanceComponent;
  let fixture: ComponentFixture<SupervisorAttendanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisorAttendanceComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SupervisorAttendanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
