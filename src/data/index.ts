import { useSyncExternalStore } from 'react';
import { getSettings, type AppSettings } from '../settings';
import { FirebaseSource } from './firebaseSource';
import { MqttSource } from './mqttSource';
import { TelemetrySimulator } from './simulator';
import type { DataSource } from './source';
import { resetStore, sink } from './store';

let source: DataSource | null = null;
const listeners = new Set<() => void>();

function create(s: AppSettings): DataSource {
  if (s.source === 'mqtt') return new MqttSource(s);
  if (s.source === 'firebase') return new FirebaseSource(s);
  return new TelemetrySimulator();
}

/** Hentikan sumber lama, kosongkan data, lalu mulai sumber sesuai pengaturan terbaru. */
export function startDataSource(settings: AppSettings = getSettings()) {
  source?.stop();
  resetStore();
  source = create(settings);
  source.start(sink);
  listeners.forEach((l) => l());
}

/** Instance simulator aktif (null bila sumber bukan simulator) — untuk tombol kontrol di topbar. */
export function useSimulator(): TelemetrySimulator | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => (source instanceof TelemetrySimulator ? source : null),
  );
}
