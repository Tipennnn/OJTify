import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOjtComponent } from './admin-ojt.component';

describe('AdminOjtComponent', () => {
  let component: AdminOjtComponent;
  let fixture: ComponentFixture<AdminOjtComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOjtComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminOjtComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
