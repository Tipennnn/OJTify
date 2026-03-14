import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternSidenavComponent } from './intern-sidenav.component';

describe('InternSidenavComponent', () => {
  let component: InternSidenavComponent;
  let fixture: ComponentFixture<InternSidenavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternSidenavComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InternSidenavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
