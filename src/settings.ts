/**
 * Pengaturan koneksi yang bisa diubah dari halaman Setting.
 * Disimpan di localStorage browser; nilai awal diambil dari .env (VITE_*).
 * Catatan keamanan: password MQTT & API key Firebase tersimpan di browser ini saja.
 * Untuk deploy publik, pakai akun broker read-only dan Firebase rules yang ketat.
 */
import { useSyncExternalStore } from 'react';

export type DataSourceKind = 'simulator' | 'mqtt' | 'firebase';

export interface MqttSettings {
  /** URL MQTT over WebSocket, mis. ws://192.168.1.10:9001 atau wss://broker.hivemq.com:8884/mqtt */
  url: string;
  username: string;
  password: string;
  /** Prefix topik, default "smartwheel" -> smartwheel/telemetry/raw */
  topicPrefix: string;
  clientId: string;
}

export interface FirebaseSettings {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  appId: string;
  /** Path root data perangkat, default "devices" -> /devices/{device_id}/... */
  rootPath: string;
}

export interface AppSettings {
  source: DataSourceKind;
  deviceId: string;
  mqtt: MqttSettings;
  firebase: FirebaseSettings;
}

const KEY = 'smartwheel.settings.v1';
const env = import.meta.env;

export const DEFAULT_SETTINGS: AppSettings = {
  source: (env.VITE_DATA_SOURCE as DataSourceKind) ?? 'simulator',
  deviceId: env.VITE_DEVICE_ID ?? 'smartwheel-01',
  mqtt: {
    url: env.VITE_MQTT_URL ?? 'ws://localhost:9001',
    username: env.VITE_MQTT_USERNAME ?? '',
    password: env.VITE_MQTT_PASSWORD ?? '',
    topicPrefix: env.VITE_MQTT_TOPIC_PREFIX ?? 'smartwheel',
    clientId: '',
  },
  firebase: {
    apiKey: env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    databaseURL: env.VITE_FIREBASE_DATABASE_URL ?? '',
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
    appId: env.VITE_FIREBASE_APP_ID ?? '',
    rootPath: 'devices',
  },
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      mqtt: { ...DEFAULT_SETTINGS.mqtt, ...s.mqtt },
      firebase: { ...DEFAULT_SETTINGS.firebase, ...s.firebase },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function getSettings() {
  return current;
}

export function saveSettings(next: AppSettings) {
  current = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function resetSettings() {
  localStorage.removeItem(KEY);
  current = DEFAULT_SETTINGS;
  listeners.forEach((l) => l());
}

export function useSettings() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => current,
  );
}

export const topics = (prefix: string) => ({
  telemetry: `${prefix}/telemetry/raw`,
  prediction: `${prefix}/prediction`,
  control: `${prefix}/control`,
  seat: `${prefix}/seat_status`,
  events: `${prefix}/events`,
});
