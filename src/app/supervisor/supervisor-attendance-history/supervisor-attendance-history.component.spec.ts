import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisorAttendanceHistoryComponent } from './supervisor-attendance-history.component';

describe('SupervisorAttendanceHistoryComponent', () => {
  let component: SupervisorAttendanceHistoryComponent;
  let fixture: ComponentFixture<SupervisorAttendanceHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisorAttendanceHistoryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SupervisorAttendanceHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
