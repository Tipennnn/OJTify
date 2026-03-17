import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminTopnavComponent } from './admin-topnav.component';

describe('AdminTopnavComponent', () => {
  let component: AdminTopnavComponent;
  let fixture: ComponentFixture<AdminTopnavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTopnavComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminTopnavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
