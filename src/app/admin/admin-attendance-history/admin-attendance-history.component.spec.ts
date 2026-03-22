import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAttendanceHistoryComponent } from './admin-attendance-history.component';

describe('AdminAttendanceHistoryComponent', () => {
  let component: AdminAttendanceHistoryComponent;
  let fixture: ComponentFixture<AdminAttendanceHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAttendanceHistoryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminAttendanceHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
