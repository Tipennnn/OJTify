import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisorSidenavComponent } from './supervisor-sidenav.component';

describe('SupervisorSidenavComponent', () => {
  let component: SupervisorSidenavComponent;
  let fixture: ComponentFixture<SupervisorSidenavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisorSidenavComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SupervisorSidenavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
