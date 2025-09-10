import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RiskJobRunnerComponent } from './risk-job-runner-component';

describe('RiskJobRunnerComponent', () => {
  let component: RiskJobRunnerComponent;
  let fixture: ComponentFixture<RiskJobRunnerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskJobRunnerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RiskJobRunnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
