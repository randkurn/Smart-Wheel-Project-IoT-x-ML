import type { TerrainClass, ToFZone } from './types/contract';

/** Ambang dari proposal (nilai awal — disesuaikan hasil uji). */
export const CONFIG = {
  deviceId: import.meta.env.VITE_DEVICE_ID ?? 'smartwheel-01',
  dataSource: (import.meta.env.VITE_DATA_SOURCE ?? 'simulator') as 'simulator' | 'firebase',
  /** Data / prediksi lebih tua dari ini ditandai STALE (SW-11) */
  staleMs: 1500,
  /** Buffer grafik accelerometer (SW-05: >= 30 s) */
  accelBufferS: 30,
  /** Rate tampilan dari bridge */
  displayHz: 10,
  maxRpm: 120,
  /** ToF zona (mm): > 500 aman, 250–500 waspada, <= 250 berhenti */
  tof: { safeMm: 500, stopMm: 250, maxRangeMm: 2000 },
  speedCapPct: { NORMAL: 100, BERGELOMBANG: 60, BERLUBANG: 40, INVALID: 30, STOP: 0 },
} as const;

export const TERRAIN_META: Record<TerrainClass, { label: string; color: string; desc: string }> = {
  NORMAL: { label: 'Normal', color: '#22c55e', desc: 'Permukaan relatif rata' },
  BERGELOMBANG: { label: 'Bergelombang', color: '#f59e0b', desc: 'Relief berulang' },
  BERLUBANG: { label: 'Berlubang / Bercekung', color: '#ef4444', desc: 'Cekungan terkontrol' },
};

export const ZONE_META: Record<ToFZone, { label: string; color: string }> = {
  AMAN: { label: 'Aman', color: '#22c55e' },
  WASPADA: { label: 'Waspada', color: '#f59e0b' },
  BERHENTI: { label: 'Berhenti', color: '#ef4444' },
  INVALID: { label: 'Tidak valid', color: '#94a3b8' },
};

export function zoneFromMm(mm: number | null, ok: boolean): ToFZone {
  if (!ok || mm == null) return 'INVALID';
  if (mm <= CONFIG.tof.stopMm) return 'BERHENTI';
  if (mm <= CONFIG.tof.safeMm) return 'WASPADA';
  return 'AMAN';
}
