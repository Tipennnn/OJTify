import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisorOjtComponent } from './supervisor-ojt.component';

describe('SupervisorOjtComponent', () => {
  let component: SupervisorOjtComponent;
  let fixture: ComponentFixture<SupervisorOjtComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisorOjtComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SupervisorOjtComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
