import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternTopnavComponent } from './intern-topnav.component';

describe('InternTopnavComponent', () => {
  let component: InternTopnavComponent;
  let fixture: ComponentFixture<InternTopnavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternTopnavComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InternTopnavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
