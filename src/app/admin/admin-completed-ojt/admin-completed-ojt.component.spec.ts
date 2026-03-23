import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCompletedOjtComponent } from './admin-completed-ojt.component';

describe('AdminCompletedOjtComponent', () => {
  let component: AdminCompletedOjtComponent;
  let fixture: ComponentFixture<AdminCompletedOjtComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCompletedOjtComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminCompletedOjtComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
