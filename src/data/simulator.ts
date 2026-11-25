/**
 * Simulator telemetri (pengganti sementara ESP32 + bridge + tim ML).
 * - IMU disimulasikan 100 Hz, di-"downsample" ke 10 Hz seperti bridge.
 * - Getaran RMS/peak dihitung per jendela 1 s dari sampel 100 Hz.
 * - Prediksi medan = DUMMY (bukan model ML) — sesuai PRD saat ML belum siap.
 * - ToF diasumsikan tipe 1 titik + servo sweep (±60°). Ubah bila tipe final berbeda (T03).
 */
import { CONFIG, zoneFromMm } from '../config';
import type { DeviceEvent, DeviceMode, Severity, TerrainClass } from '../types/contract';
import type { DataSink, DataSource } from './source';
import { getSettings } from '../settings';

const G = 9.81;
const IMU_HZ = 100;
const TICK_MS = 1000 / CONFIG.displayHz;
const SUB = IMU_HZ / CONFIG.displayHz;
const TERRAINS: TerrainClass[] = ['NORMAL', 'BERGELOMBANG', 'BERLUBANG'];
const SEGMENT_S = 12;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const gauss = () => {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
};

export interface SimControls {
  paused: boolean;
  estop: boolean;
  terrainOverride: TerrainClass | null;
}

export class TelemetrySimulator implements DataSource {
  readonly kind = 'simulator' as const;
  controls: SimControls = { paused: false, estop: false, terrainOverride: null };

  private sink: DataSink | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tSim = 0; // detik waktu perangkat
  private rpmL = 0;
  private rpmR = 0;
  private lastAvgRpm = 0;
  private vibWin: number[] = [];
  private servoAngle = -60;
  private servoDir = 1;
  private frontMin = Infinity;
  private lastPredAt = -1000;
  private predTerrain: TerrainClass = 'NORMAL';
  private prev = { terrain: '', zone: '', mode: '', imbalance: false };
  private evtSeq = 0;

  start(sink: DataSink) {
    this.sink = sink;
    sink.connection({ mqtt: true, firebase: false, source: 'simulator' });
    sink.modelInfo({
      name: 'Dummy terrain predictor (simulator)',
      version: 'sim-0.1',
      algorithm: '— belum ada model ML (menunggu tim ML)',
      features: ['mean', 'std', 'rms', 'max', 'min', 'peak-to-peak', 'median', 'gyro', 'rpm'],
      window_s: 1.0,
      step_s: 0.5,
      inference_latency_ms: null,
      trained_at: null,
    });
    this.emitEvent('info', 'SIM_START', 'Simulator telemetri aktif (data bukan dari perangkat asli)');
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Jeda pengiriman paket — untuk menguji tampilan STALE/offline. */
  setPaused(p: boolean) {
    this.controls.paused = p;
    this.sink?.connection({ mqtt: !p, firebase: false, source: 'simulator' });
  }
  setEstop(v: boolean) {
    this.controls.estop = v;
  }
  setTerrain(t: TerrainClass | null) {
    this.controls.terrainOverride = t;
  }

  private emitEvent(severity: Severity, type: string, message: string) {
    const e: DeviceEvent = {
      event_id: `EVT-${String(++this.evtSeq).padStart(5, '0')}`,
      timestamp_ms: this.deviceMs(),
      type,
      severity,
      message,
    };
    this.sink?.event(e);
  }

  private deviceMs() {
    return Math.round(this.tSim * 1000);
  }

  private terrainAt(tS: number): TerrainClass {
    if (this.controls.terrainOverride) return this.controls.terrainOverride;
    return TERRAINS[Math.floor(Math.max(0, tS) / SEGMENT_S) % TERRAINS.length];
  }

  /** Satu sampel IMU 100 Hz: percepatan dinamis menurut medan. */
  private imuSample(terrain: TerrainClass, speedFrac: number, t: number) {
    let dyn = gauss() * 0.15;
    if (terrain === 'BERGELOMBANG') {
      dyn += Math.sin(2 * Math.PI * (2 + 4 * speedFrac) * t) * 1.6 * (0.4 + speedFrac) + gauss() * 0.35;
    }
    if (terrain === 'BERLUBANG') {
      dyn += gauss() * 0.5;
      if (Math.random() < 0.012 * (0.5 + speedFrac)) dyn += (Math.random() > 0.5 ? 1 : -1) * rand(3, 6);
    }
    dyn *= 0.3 + 0.7 * speedFrac; // makin pelan, makin kecil guncangan
    const roll = terrain === 'BERLUBANG' ? Math.sin(t * 1.3) * 0.08 : Math.sin(t * 0.7) * 0.02;
    const pitch = Math.sin(t * 0.4) * 0.03 + (terrain === 'BERGELOMBANG' ? Math.sin(t * 6) * 0.04 : 0);
    const accel = ((this.rpmL + this.rpmR) / 2 - this.lastAvgRpm) * 0.05;
    return {
      dyn,
      ax: -G * Math.sin(pitch) + gauss() * 0.12 + accel,
      ay: G * Math.sin(roll) * Math.cos(pitch) + gauss() * 0.12,
      az: G * Math.cos(roll) * Math.cos(pitch) + dyn,
      gx: roll * 40 + gauss() * 1.5,
      gy: pitch * 40 + gauss() * 1.5,
      gz: (this.rpmL - this.rpmR) * 0.6 + gauss() * 1.2,
    };
  }

  /** Lingkungan ToF: dinding samping + objek yang mendekat dari depan secara periodik. */
  private tofRead(angle: number): number | null {
    if (Math.random() < 0.01) return null; // pembacaan invalid sesekali
    const hits: number[] = [];
    const approach = (this.tSim % 25) / 25; // 0..1
    if (Math.abs(angle - 5) < 12) hits.push(1900 - approach * 1750);
    if (Math.abs(angle) > 35) hits.push(700 / Math.sin((Math.abs(angle) * Math.PI) / 180));
    if (angle < -15 && angle > -30) hits.push(1400);
    const d = hits.length ? Math.min(...hits) : CONFIG.tof.maxRangeMm;
    return Math.max(30, Math.min(CONFIG.tof.maxRangeMm, d + gauss() * 8));
  }

  private tick() {
    if (this.controls.paused) {
      // waktu perangkat tetap berjalan, tapi tidak ada paket terkirim (uji stale)
      this.tSim += TICK_MS / 1000;
      return;
    }
    const sink = this.sink!;
    const terrain = this.terrainAt(this.tSim);
    const now = this.deviceMs();

    // --- Prediksi DUMMY tiap 0,5 s (meniru step inferensi), lag ~0,6 s dari medan aktual
    if (now - this.lastPredAt >= 500) {
      this.lastPredAt = now;
      const lagged = this.terrainAt(this.tSim - 0.6);
      const wrong = Math.random() < 0.06;
      this.predTerrain = wrong ? TERRAINS[(TERRAINS.indexOf(lagged) + 1) % 3] : lagged;
      sink.prediction({
        timestamp_ms: now,
        terrain_class: this.predTerrain,
        confidence: +(wrong ? rand(0.45, 0.62) : rand(0.78, 0.97)).toFixed(3),
        model_version: 'sim-0.1',
        valid_until_ms: now + CONFIG.staleMs,
      });
    }

    // --- Kendali: joystick -> mixing diferensial -> cap medan & keselamatan
    const T = 0.75 + 0.25 * Math.sin(this.tSim * 0.3);
    const R = 0.35 * Math.sin(this.tSim * 0.17);
    let uL = T + R;
    let uR = T - R;
    const n = Math.max(1, Math.abs(uL), Math.abs(uR));
    uL /= n;
    uR /= n;

    const obstacleStop = this.frontMin <= CONFIG.tof.stopMm;
    let cap: number = CONFIG.speedCapPct[this.predTerrain];
    let mode: DeviceMode = 'NORMAL';
    if (this.controls.estop) {
      cap = 0;
      mode = 'E_STOP';
    } else if (obstacleStop) {
      cap = 0;
      mode = 'PROTEKSI';
    }
    const targetL = (uL * CONFIG.maxRpm * cap) / 100;
    const targetR = (uR * CONFIG.maxRpm * cap) / 100;

    // --- 10 sampel IMU 100 Hz per tick
    let last = this.imuSample(terrain, 0, this.tSim);
    for (let i = 0; i < SUB; i++) {
      this.rpmL += (targetL - this.rpmL) * 0.04 + gauss() * 0.3;
      this.rpmR += (targetR - this.rpmR) * 0.04 + gauss() * 0.3;
      const speedFrac = Math.min(1, Math.abs((this.rpmL + this.rpmR) / 2) / CONFIG.maxRpm);
      last = this.imuSample(terrain, speedFrac, this.tSim + i / IMU_HZ);
      this.vibWin.push(last.dyn);
      if (this.vibWin.length > IMU_HZ) this.vibWin.shift();
    }
    this.lastAvgRpm = (this.rpmL + this.rpmR) / 2;
    const rms = Math.sqrt(this.vibWin.reduce((a, v) => a + v * v, 0) / this.vibWin.length);
    const peak = Math.max(...this.vibWin.map(Math.abs));

    // --- ToF servo sweep ±60°, 6° per tick
    this.servoAngle += 6 * this.servoDir;
    if (this.servoAngle >= 60 || this.servoAngle <= -60) this.servoDir *= -1;
    const mm = this.tofRead(this.servoAngle);
    if (mm != null && Math.abs(this.servoAngle) <= 15) {
      this.frontMin = Math.abs(this.servoAngle) <= 3 ? mm : Math.min(this.frontMin, mm);
    }
    const zone = zoneFromMm(mm, mm != null);

    sink.control({
      timestamp_ms: now,
      remote_command: { t: +T.toFixed(2), r: +R.toFixed(2) },
      speed_cap_pct: cap,
      target_rpm_l: +targetL.toFixed(1),
      target_rpm_r: +targetR.toFixed(1),
      mode,
      emergency_stop: this.controls.estop,
      buzzer: mode !== 'NORMAL',
      remote_link: true,
    });

    sink.telemetry({
      device_id: getSettings().deviceId,
      timestamp_ms: now,
      trial_id: `S01-T${String(Math.floor(this.tSim / (SEGMENT_S * 3)) + 1).padStart(3, '0')}`,
      imu: {
        ax: +last.ax.toFixed(3),
        ay: +last.ay.toFixed(3),
        az: +last.az.toFixed(3),
        gx: +last.gx.toFixed(2),
        gy: +last.gy.toFixed(2),
        gz: +last.gz.toFixed(2),
      },
      rpm_left: +this.rpmL.toFixed(1),
      rpm_right: +this.rpmR.toFixed(1),
      tof_mm: mm == null ? null : Math.round(mm),
      tof_ok: mm != null,
      tof_zone: zone,
      tof_angle_deg: this.servoAngle,
      sensor_ok: true,
      vib: { rms: +rms.toFixed(3), peak: +peak.toFixed(3), window_ms: 1000 },
    });

    // --- Dudukan (FSR): episode ketidakseimbangan berkala
    const imbalance = this.tSim % 40 > 33;
    const base = 25 + gauss();
    const shift = imbalance ? 9 : 0;
    sink.seat({
      timestamp_ms: now,
      pressure_fl: +(base + shift + gauss()).toFixed(1),
      pressure_fr: +(base - shift + gauss()).toFixed(1),
      pressure_rl: +(base + shift + gauss()).toFixed(1),
      pressure_rr: +(base - shift + gauss()).toFixed(1),
      imbalance_flag: imbalance,
    });

    // --- Event log dari transisi status
    const frontZone = zoneFromMm(Number.isFinite(this.frontMin) ? this.frontMin : null, true);
    if (terrain !== this.prev.terrain) this.emitEvent('info', 'TERRAIN_CHANGE', `Lintasan berganti ke ${terrain}`);
    if (frontZone !== this.prev.zone && frontZone === 'BERHENTI')
      this.emitEvent('critical', 'OBSTACLE_STOP', `Hambatan depan ${Math.round(this.frontMin)} mm — gerak maju dihentikan`);
    if (frontZone !== this.prev.zone && frontZone === 'WASPADA')
      this.emitEvent('warning', 'OBSTACLE_WARN', `Hambatan depan ${Math.round(this.frontMin)} mm (zona waspada)`);
    if (mode !== this.prev.mode && mode === 'E_STOP') this.emitEvent('critical', 'E_STOP', 'Emergency stop aktif');
    if (mode !== this.prev.mode && this.prev.mode === 'E_STOP') this.emitEvent('info', 'E_STOP_RESET', 'Emergency stop di-reset');
    if (imbalance && !this.prev.imbalance)
      this.emitEvent('warning', 'SEAT_IMBALANCE', 'Distribusi beban dudukan tidak seimbang (kiri > kanan)');
    this.prev = { terrain, zone: frontZone, mode, imbalance };

    this.tSim += TICK_MS / 1000;
  }
}
