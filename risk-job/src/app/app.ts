import { Component, signal } from '@angular/core';
import { RiskJobRunnerComponent } from './components/risk-job-runner-component/risk-job-runner-component';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [
    RiskJobRunnerComponent,
    HttpClientModule
  ]
})
export class AppComponent {
  protected readonly title = signal('risk-job');
}
