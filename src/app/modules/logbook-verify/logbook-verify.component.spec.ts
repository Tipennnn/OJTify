import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogbookVerifyComponent } from './logbook-verify.component';

describe('LogbookVerifyComponent', () => {
  let component: LogbookVerifyComponent;
  let fixture: ComponentFixture<LogbookVerifyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogbookVerifyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LogbookVerifyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
