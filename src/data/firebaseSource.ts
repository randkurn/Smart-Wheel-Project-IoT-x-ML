/**
 * Sumber data Firebase Realtime Database (diisi bridge MQTT -> Firebase).
 * Path (relatif ke rootPath, default "devices"):
 *   /{root}/{device_id}/telemetry/latest
 *   /{root}/{device_id}/prediction/latest
 *   /{root}/{device_id}/control/latest
 *   /{root}/{device_id}/seat_status/latest
 *   /{root}/{device_id}/events/{event_id}
 *   /model_info
 * Sesuaikan dengan skema final tim Database & Cloud (T10).
 */
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getDatabase, limitToLast, onChildAdded, onValue, query, ref, type Database, type Unsubscribe,
} from 'firebase/database';
import type { AppSettings, FirebaseSettings } from '../settings';
import type { ModelInfo } from '../types/contract';
import { toControl, toEvent, toPrediction, toSeat, toTelemetry } from './normalize';
import type { DataSink, DataSource } from './source';

export function firebaseMissing(f: FirebaseSettings) {
  return (['apiKey', 'databaseURL', 'projectId'] as const).filter((k) => !f[k].trim());
}

export function openFirebase(f: FirebaseSettings, name: string): { app: FirebaseApp; db: Database } {
  const app = initializeApp(
    { apiKey: f.apiKey, authDomain: f.authDomain, databaseURL: f.databaseURL, projectId: f.projectId, appId: f.appId },
    name,
  );
  return { app, db: getDatabase(app, f.databaseURL) };
}

export class FirebaseSource implements DataSource {
  readonly kind = 'firebase' as const;
  private app: FirebaseApp | null = null;
  private unsubs: Unsubscribe[] = [];

  constructor(private settings: AppSettings) {}

  start(sink: DataSink) {
    const s = this.settings;
    const missing = firebaseMissing(s.firebase);
    if (missing.length) {
      sink.connection({ mqtt: false, firebase: false, source: 'firebase', error: `Config belum lengkap: ${missing.join(', ')}` });
      return;
    }
    let db: Database;
    try {
      const opened = openFirebase(s.firebase, `sw-live-${Date.now()}`);
      this.app = opened.app;
      db = opened.db;
    } catch (e) {
      sink.connection({ mqtt: false, firebase: false, source: 'firebase', error: String(e) });
      return;
    }
    const base = `${s.firebase.rootPath}/${s.deviceId}`;
    const onErr = (e: Error) => sink.connection({ mqtt: false, firebase: false, source: 'firebase', error: e.message });

    this.unsubs.push(
      onValue(ref(db, '.info/connected'), (snap) =>
        sink.connection({ mqtt: false, firebase: snap.val() === true, source: 'firebase' })),
      onValue(ref(db, `${base}/telemetry/latest`), (snap) => {
        if (snap.exists()) sink.telemetry(toTelemetry(snap.val(), s.deviceId));
      }, onErr),
      onValue(ref(db, `${base}/prediction/latest`), (snap) => {
        const p = snap.exists() ? toPrediction(snap.val()) : null;
        if (p) sink.prediction(p);
      }, onErr),
      onValue(ref(db, `${base}/control/latest`), (snap) => {
        if (snap.exists()) sink.control(toControl(snap.val()));
      }, onErr),
      onValue(ref(db, `${base}/seat_status/latest`), (snap) => {
        if (snap.exists()) sink.seat(toSeat(snap.val()));
      }, onErr),
      onChildAdded(query(ref(db, `${base}/events`), limitToLast(50)), (snap) => {
        sink.event(toEvent(snap.val() ?? {}, snap.key ?? undefined));
      }, onErr),
      onValue(ref(db, 'model_info'), (snap) => {
        sink.modelInfo(snap.exists() ? (snap.val() as ModelInfo) : null);
      }, onErr),
    );
  }

  stop() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.app) void deleteApp(this.app);
    this.app = null;
  }
}
