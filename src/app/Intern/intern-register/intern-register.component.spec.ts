import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternRegisterComponent } from './intern-register.component';

describe('InternRegisterComponent', () => {
  let component: InternRegisterComponent;
  let fixture: ComponentFixture<InternRegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternRegisterComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InternRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
