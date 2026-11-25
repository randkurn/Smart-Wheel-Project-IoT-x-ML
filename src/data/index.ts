import { CONFIG } from '../config';
import { FirebaseSource } from './firebaseSource';
import { TelemetrySimulator } from './simulator';
import type { DataSource } from './source';
import { sink } from './store';

export const simulator = CONFIG.dataSource === 'simulator' ? new TelemetrySimulator() : null;
const source: DataSource = simulator ?? new FirebaseSource();

let started = false;
export function startDataSource() {
  if (started) return;
  started = true;
  source.start(sink);
}
