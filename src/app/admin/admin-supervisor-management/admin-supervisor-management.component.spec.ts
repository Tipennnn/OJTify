import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminSupervisorManagementComponent } from './admin-supervisor-management.component';

describe('AdminSupervisorManagementComponent', () => {
  let component: AdminSupervisorManagementComponent;
  let fixture: ComponentFixture<AdminSupervisorManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSupervisorManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminSupervisorManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
