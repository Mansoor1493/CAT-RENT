import { startOverdueChecker } from './overdueChecker';
import { startTelemetrySimulator } from './telemetrySimulator';

export function initializeJobs(): void {
  startOverdueChecker();
  startTelemetrySimulator();
}
