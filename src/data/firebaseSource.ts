/**
 * Sumber data Firebase — STUB untuk Fase 1 (T08/T10).
 * Rencana path Realtime Database (sesuaikan dengan skema final):
 *   /devices/{device_id}/telemetry/latest
 *   /devices/{device_id}/prediction/latest
 *   /devices/{device_id}/control/latest
 *   /devices/{device_id}/seat_status/latest
 *   /devices/{device_id}/events/{event_id}
 *   /model_info, /ml_eval
 * Implementasi: `npm i firebase`, inisialisasi dari VITE_FIREBASE_* (.env),
 * lalu onValue(...) tiap path -> panggil sink.telemetry(...), dst.
 */
import type { DataSink, DataSource } from './source';

export class FirebaseSource implements DataSource {
  readonly kind = 'firebase' as const;

  start(sink: DataSink) {
    sink.connection({ mqtt: false, firebase: false, source: 'firebase' });
    sink.event({
      event_id: 'EVT-FB-0',
      timestamp_ms: 0,
      type: 'NOT_IMPLEMENTED',
      severity: 'warning',
      message: 'Sumber Firebase belum diimplementasi — set VITE_DATA_SOURCE=simulator',
    });
  }

  stop() {}
}
