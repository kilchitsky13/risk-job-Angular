import { Component } from '@angular/core';
import { BorrowerRisk } from '../../models/borrower-risk';
import { RiskJobService } from '../../services/risk-job-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-risk-job-runner-component',
  templateUrl: './risk-job-runner-component.html',
  styleUrl: './risk-job-runner-component.scss',
  imports: [CommonModule]
})
export class RiskJobRunnerComponent {
  risks: BorrowerRisk[] = [];
  loading = false;
  error: string | null = null;
  message: string | null = null;

  constructor(private riskService: RiskJobService) {}

  runRiskJob(): void {
    this.loading = true;
    this.error = null;
    this.message = null;
    this.riskService.runRiskJob().subscribe({
      next: data => {
        this.risks = data || [];
        this.message = `Loaded ${this.risks.length} borrower(s).`;
        this.loading = false;
      },
      error: err => {
        this.error = err?.message ?? 'Failed to run risk job';
        this.loading = false;
      }
    });
  }

  initRisk(): void {
    this.loading = true;
    this.error = null;
    this.message = null;
    this.riskService.initRisk().subscribe({
      next: () => {
        this.message = 'Init request sent successfully.';
        this.loading = false;
      },
      error: err => {
        this.error = err?.message ?? 'Failed to init risk';
        this.loading = false;
      }
    });
  }
}
