import { useSyncExternalStore } from 'react';
import { CONFIG } from '../config';
import { getSettings } from '../settings';
import type {
  ConnectionStatus, ControlStatus, DeviceEvent, ModelInfo, Prediction, SeatStatus, Telemetry,
} from '../types/contract';
import type { DataSink } from './source';

export interface AccelPoint { t: number; ax: number; ay: number; az: number }
export interface VibPoint { t: number; rms: number; peak: number }
export interface RpmPoint { t: number; left: number; right: number; targetL: number; targetR: number }
export interface TofPoint { angle: number; mm: number | null; t: number }

export interface DashboardState {
  telemetry: Telemetry | null;
  prediction: Prediction | null;
  control: ControlStatus | null;
  seat: SeatStatus | null;
  modelInfo: ModelInfo | null;
  connection: ConnectionStatus;
  events: DeviceEvent[];
  accelHistory: AccelPoint[];
  vibHistory: VibPoint[];
  rpmHistory: RpmPoint[];
  /** Titik sweep ToF terbaru per sudut (untuk radar) */
  tofSweep: TofPoint[];
  /** Waktu terima paket terakhir (jam browser) — dasar status online/stale */
  lastRxAt: number | null;
}

const MAX_POINTS = CONFIG.accelBufferS * CONFIG.displayHz; // 30 s @ 10 Hz
const MAX_EVENTS = 200;

const initialState = (): DashboardState => ({
  telemetry: null,
  prediction: null,
  control: null,
  seat: null,
  modelInfo: null,
  connection: { mqtt: false, firebase: false, source: getSettings().source },
  events: [],
  accelHistory: [],
  vibHistory: [],
  rpmHistory: [],
  tofSweep: [],
  lastRxAt: null,
});

let state: DashboardState = initialState();

const listeners = new Set<() => void>();
function set(patch: Partial<DashboardState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

/** Kosongkan semua data — dipakai saat berganti sumber data. */
export function resetStore() {
  state = initialState();
  listeners.forEach((l) => l());
}
const push = <T,>(arr: T[], item: T, max = MAX_POINTS) => {
  const next = arr.length >= max ? arr.slice(arr.length - max + 1) : arr.slice();
  next.push(item);
  return next;
};

export const sink: DataSink = {
  telemetry(t) {
    const tofSweep =
      t.tof_angle_deg == null
        ? [{ angle: 0, mm: t.tof_mm, t: t.timestamp_ms }]
        : [...state.tofSweep.filter((p) => Math.abs(p.angle - t.tof_angle_deg!) > 1 && t.timestamp_ms - p.t < 4000),
           { angle: t.tof_angle_deg, mm: t.tof_ok ? t.tof_mm : null, t: t.timestamp_ms }];
    const c = state.control;
    set({
      telemetry: t,
      lastRxAt: Date.now(),
      accelHistory: push(state.accelHistory, { t: t.timestamp_ms, ax: t.imu.ax, ay: t.imu.ay, az: t.imu.az }),
      vibHistory: push(state.vibHistory, { t: t.timestamp_ms, rms: t.vib.rms, peak: t.vib.peak }),
      rpmHistory: push(state.rpmHistory, {
        t: t.timestamp_ms, left: t.rpm_left, right: t.rpm_right,
        targetL: c?.target_rpm_l ?? 0, targetR: c?.target_rpm_r ?? 0,
      }),
      tofSweep,
    });
  },
  prediction: (p) => set({ prediction: p }),
  control: (c) => set({ control: c }),
  seat: (s) => set({ seat: s }),
  event: (e) => set({ events: [e, ...state.events].slice(0, MAX_EVENTS) }),
  connection: (c) => set({ connection: c }),
  modelInfo: (m) => set({ modelInfo: m }),
};

export function useDashboard<T>(selector: (s: DashboardState) => T): T {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => selector(state),
  );
}
