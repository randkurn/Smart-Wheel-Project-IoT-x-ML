/**
 * Kontrak data SMART-WHEEL (draft Fase 0 — dibekukan oleh Tech Lead).
 * Mengikuti Lampiran A proposal + perubahan PRD: ultrasonik -> ToF.
 * Field dinamai sama dengan payload MQTT / node Firebase.
 */

export type TerrainClass = 'NORMAL' | 'BERGELOMBANG' | 'BERLUBANG';
export type ToFZone = 'AMAN' | 'WASPADA' | 'BERHENTI' | 'INVALID';
export type DeviceMode = 'NORMAL' | 'PROTEKSI' | 'E_STOP';
export type Severity = 'info' | 'warning' | 'critical';

/** smartwheel/telemetry/raw (sudah di-downsample bridge ke >= 5 Hz) */
export interface Telemetry {
  device_id: string;
  timestamp_ms: number;
  trial_id: string;
  imu: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number }; // m/s², °/s
  rpm_left: number;
  rpm_right: number;
  /** ToF menggantikan ultrasonik */
  tof_mm: number | null;
  tof_ok: boolean;
  tof_zone: ToFZone;
  /** Sudut servo (derajat, 0 = depan) bila ToF tipe sweep; null untuk 1 titik */
  tof_angle_deg: number | null;
  sensor_ok: boolean;
  /** Dihitung bridge dari IMU 100 Hz, jendela 1 s */
  vib: { rms: number; peak: number; window_ms: number };
}

/** smartwheel/prediction — diisi tim ML (sekarang dummy simulator) */
export interface Prediction {
  timestamp_ms: number;
  terrain_class: TerrainClass;
  confidence: number; // 0..1
  model_version: string;
  valid_until_ms: number;
}

export interface ControlStatus {
  timestamp_ms: number;
  remote_command: { t: number; r: number }; // -1..1
  speed_cap_pct: number;
  target_rpm_l: number;
  target_rpm_r: number;
  mode: DeviceMode;
  emergency_stop: boolean;
  buzzer: boolean;
  remote_link: boolean;
}

export interface SeatStatus {
  timestamp_ms: number;
  pressure_fl: number;
  pressure_fr: number;
  pressure_rl: number;
  pressure_rr: number;
  imbalance_flag: boolean;
}

export interface DeviceEvent {
  event_id: string;
  timestamp_ms: number;
  type: string;
  severity: Severity;
  message: string;
  resolution?: string;
}

export interface ModelInfo {
  name: string;
  version: string;
  algorithm: string;
  features: string[];
  window_s: number;
  step_s: number;
  inference_latency_ms: number | null;
  trained_at: string | null;
}

export interface ConnectionStatus {
  mqtt: boolean;
  firebase: boolean;
  source: 'simulator' | 'mqtt' | 'firebase';
  /** Pesan error koneksi terakhir (bila ada) */
  error?: string;
}
