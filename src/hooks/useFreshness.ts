import { CONFIG } from '../config';
import { useDashboard } from '../data/store';
import { useNow } from './useNow';

/** SW-11: status online / stale / offline berdasarkan paket terakhir & valid_until prediksi. */
export function useFreshness() {
  const now = useNow();
  const lastRxAt = useDashboard((s) => s.lastRxAt);
  const prediction = useDashboard((s) => s.prediction);
  const telemetry = useDashboard((s) => s.telemetry);

  const ageMs = lastRxAt == null ? null : now - lastRxAt;
  const dataStale = ageMs == null || ageMs > CONFIG.staleMs;
  const offline = ageMs == null || ageMs > 5000;

  // Umur prediksi dihitung dalam jam perangkat (timestamp_ms) relatif telemetri terbaru,
  // ditambah jeda sejak paket terakhir diterima.
  let predAgeMs: number | null = null;
  let predStale = true;
  if (prediction && telemetry) {
    predAgeMs = telemetry.timestamp_ms - prediction.timestamp_ms + (ageMs ?? 0);
    const pastValid = telemetry.timestamp_ms + (ageMs ?? 0) > prediction.valid_until_ms;
    predStale = pastValid || predAgeMs > CONFIG.staleMs;
  }
  return { now, ageMs, dataStale, offline, predAgeMs, predStale };
}
