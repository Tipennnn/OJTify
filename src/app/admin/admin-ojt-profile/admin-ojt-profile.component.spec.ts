import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOjtProfileComponent } from './admin-ojt-profile.component';

describe('AdminOjtProfileComponent', () => {
  let component: AdminOjtProfileComponent;
  let fixture: ComponentFixture<AdminOjtProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOjtProfileComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminOjtProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
