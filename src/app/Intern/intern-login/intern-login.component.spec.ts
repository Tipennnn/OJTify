import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternLoginComponent } from './intern-login.component';

describe('InternLoginComponent', () => {
  let component: InternLoginComponent;
  let fixture: ComponentFixture<InternLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternLoginComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InternLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
