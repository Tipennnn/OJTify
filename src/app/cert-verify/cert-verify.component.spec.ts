import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CertVerifyComponent } from './cert-verify.component';

describe('CertVerifyComponent', () => {
  let component: CertVerifyComponent;
  let fixture: ComponentFixture<CertVerifyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertVerifyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CertVerifyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
