import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisorTasksComponent } from './supervisor-tasks.component';

describe('SupervisorTasksComponent', () => {
  let component: SupervisorTasksComponent;
  let fixture: ComponentFixture<SupervisorTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisorTasksComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SupervisorTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
