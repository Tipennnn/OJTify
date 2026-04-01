import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisorLoginComponent } from './supervisor-login.component';

describe('SupervisorLoginComponent', () => {
  let component: SupervisorLoginComponent;
  let fixture: ComponentFixture<SupervisorLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisorLoginComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SupervisorLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
