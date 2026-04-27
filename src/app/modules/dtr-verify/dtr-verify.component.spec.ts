import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DtrVerifyComponent } from './dtr-verify.component';

describe('DtrVerifyComponent', () => {
  let component: DtrVerifyComponent;
  let fixture: ComponentFixture<DtrVerifyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DtrVerifyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DtrVerifyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
