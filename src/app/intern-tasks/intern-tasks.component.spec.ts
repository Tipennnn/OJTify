import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternTasksComponent } from './intern-tasks.component';

describe('InternTasksComponent', () => {
  let component: InternTasksComponent;
  let fixture: ComponentFixture<InternTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternTasksComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InternTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
