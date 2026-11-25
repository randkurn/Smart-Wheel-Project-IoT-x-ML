/**
 * Mengubah payload mentah (MQTT / Firebase) menjadi tipe kontrak dashboard.
 * Toleran terhadap field yang belum ada, mis. firmware lama yang masih
 * mengirim `distance_cm` (ultrasonik) atau belum mengirim `vib`.
 */
import { zoneFromMm } from '../config';
import type {
  ControlStatus, DeviceEvent, Prediction, SeatStatus, Telemetry, TerrainClass,
} from '../types/contract';

type Raw = Record<string, unknown>;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const G = 9.81;

/** Hitung RMS & peak percepatan dinamis dari sampel IMU mentah (jendela 1 s). */
export class VibrationWindow {
  private buf: { t: number; dyn: number }[] = [];
  push(t: number, ax: number, ay: number, az: number) {
    this.buf.push({ t, dyn: Math.hypot(ax, ay, az) - G });
    while (this.buf.length && t - this.buf[0].t > 1000) this.buf.shift();
  }
  value() {
    if (!this.buf.length) return { rms: 0, peak: 0, window_ms: 1000 };
    const rms = Math.sqrt(this.buf.reduce((a, s) => a + s.dyn * s.dyn, 0) / this.buf.length);
    const peak = Math.max(...this.buf.map((s) => Math.abs(s.dyn)));
    return { rms, peak, window_ms: 1000 };
  }
}

export function toTelemetry(r: Raw, deviceId: string, vib?: VibrationWindow): Telemetry {
  const imuRaw = (r.imu as Raw) ?? r;
  const imu = {
    ax: num(imuRaw.ax), ay: num(imuRaw.ay), az: num(imuRaw.az, G),
    gx: num(imuRaw.gx), gy: num(imuRaw.gy), gz: num(imuRaw.gz),
  };
  const ts = num(r.timestamp_ms, Date.now());
  let tofMm: number | null =
    typeof r.tof_mm === 'number' ? r.tof_mm : typeof r.distance_cm === 'number' ? r.distance_cm * 10 : null;
  const tofOk = typeof r.tof_ok === 'boolean' ? r.tof_ok : tofMm != null;
  if (!tofOk) tofMm = null;
  vib?.push(ts, imu.ax, imu.ay, imu.az);
  const v = r.vib as Raw | undefined;
  return {
    device_id: str(r.device_id, deviceId),
    timestamp_ms: ts,
    trial_id: str(r.trial_id, '—'),
    imu,
    rpm_left: num(r.rpm_left ?? r.rpm_l),
    rpm_right: num(r.rpm_right ?? r.rpm_r),
    tof_mm: tofMm,
    tof_ok: tofOk,
    tof_zone: zoneFromMm(tofMm, tofOk),
    tof_angle_deg: typeof r.tof_angle_deg === 'number' ? r.tof_angle_deg : null,
    sensor_ok: typeof r.sensor_ok === 'boolean' ? r.sensor_ok : true,
    vib: v
      ? { rms: num(v.rms), peak: num(v.peak), window_ms: num(v.window_ms, 1000) }
      : vib?.value() ?? { rms: 0, peak: 0, window_ms: 1000 },
  };
}

const CLASSES: TerrainClass[] = ['NORMAL', 'BERGELOMBANG', 'BERLUBANG'];
export function toPrediction(r: Raw): Prediction | null {
  const c = str(r.terrain_class ?? r.terrain_label).toUpperCase() as TerrainClass;
  if (!CLASSES.includes(c)) return null;
  const ts = num(r.timestamp_ms, Date.now());
  return {
    timestamp_ms: ts,
    terrain_class: c,
    confidence: num(r.confidence),
    model_version: str(r.model_version, 'unknown'),
    valid_until_ms: num(r.valid_until_ms, ts + 1500),
  };
}

export function toControl(r: Raw): ControlStatus {
  const cmd = (r.remote_command as Raw) ?? {};
  const mode = str(r.mode, 'NORMAL').toUpperCase().replace('-', '_');
  return {
    timestamp_ms: num(r.timestamp_ms, Date.now()),
    remote_command: { t: num(cmd.t), r: num(cmd.r) },
    speed_cap_pct: num(r.speed_cap_pct, 100),
    target_rpm_l: num(r.target_rpm_l),
    target_rpm_r: num(r.target_rpm_r),
    mode: (['NORMAL', 'PROTEKSI', 'E_STOP'].includes(mode) ? mode : 'NORMAL') as ControlStatus['mode'],
    emergency_stop: r.emergency_stop === true,
    buzzer: r.buzzer === true,
    remote_link: r.remote_link !== false,
  };
}

export function toSeat(r: Raw): SeatStatus {
  return {
    timestamp_ms: num(r.timestamp_ms, Date.now()),
    pressure_fl: num(r.pressure_fl), pressure_fr: num(r.pressure_fr),
    pressure_rl: num(r.pressure_rl), pressure_rr: num(r.pressure_rr),
    imbalance_flag: r.imbalance_flag === true,
  };
}

let evtSeq = 0;
export function toEvent(r: Raw, id?: string): DeviceEvent {
  const sev = str(r.severity, 'info');
  return {
    event_id: id ?? str(r.event_id, `EVT-RX-${++evtSeq}`),
    timestamp_ms: num(r.timestamp_ms, Date.now()),
    type: str(r.type, 'EVENT'),
    severity: (['info', 'warning', 'critical'].includes(sev) ? sev : 'info') as DeviceEvent['severity'],
    message: str(r.message, str(r.type, '')),
    resolution: typeof r.resolution === 'string' ? r.resolution : undefined,
  };
}

export function parseJson(payload: Uint8Array | string): Raw | null {
  try {
    const text = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? (v as Raw) : null;
  } catch {
    return null;
  }
}
