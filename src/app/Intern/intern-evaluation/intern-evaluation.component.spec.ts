import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternEvaluationComponent } from './intern-evaluation.component';

describe('InternEvaluationComponent', () => {
  let component: InternEvaluationComponent;
  let fixture: ComponentFixture<InternEvaluationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternEvaluationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InternEvaluationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
