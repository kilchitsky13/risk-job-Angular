import { TestBed } from '@angular/core/testing';

import { RiskJobService } from './risk-job-service';

describe('RiskJobService', () => {
  let service: RiskJobService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RiskJobService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
