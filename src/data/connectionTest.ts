/**
 * Cek koneksi untuk halaman Setting. Berjalan terpisah dari sumber data aktif,
 * jadi bisa menguji pengaturan baru sebelum disimpan.
 */
import mqtt from 'mqtt';
import { deleteApp } from 'firebase/app';
import { get, onValue, ref } from 'firebase/database';
import { topics, type AppSettings } from '../settings';
import { firebaseMissing, openFirebase } from './firebaseSource';
import { mqttOptions } from './mqttSource';
import { parseJson } from './normalize';

export type StepStatus = 'ok' | 'warn' | 'fail' | 'skip';
export interface TestStep {
  label: string;
  status: StepStatus;
  detail: string;
  ms?: number;
}

const since = (t0: number) => Math.round(performance.now() - t0);

/** MQTT: broker -> subscribe -> data telemetri dari alat -> prediksi dari layanan ML. */
export function testMqtt(s: AppSettings, listenMs = 5000): Promise<TestStep[]> {
  return new Promise((resolve) => {
    const steps: TestStep[] = [];
    const url = s.mqtt.url.trim();
    if (!/^wss?:\/\//.test(url)) {
      resolve([{ label: 'URL broker', status: 'fail', detail: 'URL harus diawali ws:// atau wss:// (MQTT over WebSocket)' }]);
      return;
    }
    if (location.protocol === 'https:' && url.startsWith('ws://')) {
      steps.push({ label: 'Keamanan', status: 'warn', detail: 'Halaman HTTPS tidak boleh membuka ws:// — gunakan wss://' });
    }
    const t = topics(s.mqtt.topicPrefix);
    const t0 = performance.now();
    let finished = false;
    let sample: Record<string, unknown> | null = null;
    let telemetryCount = 0;
    let telemetryAt = 0;
    let predictionAt = 0;
    const client = mqtt.connect(url, { ...mqttOptions(s), reconnectPeriod: 0 });

    const finish = (extra?: TestStep) => {
      if (finished) return;
      finished = true;
      if (extra) steps.push(extra);
      client.end(true);
      resolve(steps);
    };

    const hardTimeout = setTimeout(() => {
      finish({ label: 'Broker MQTT', status: 'fail', detail: `Tidak ada respons dalam 6 s dari ${url}` });
    }, 6000);

    client.on('error', (err) => {
      clearTimeout(hardTimeout);
      finish({ label: 'Broker MQTT', status: 'fail', detail: err.message || 'Gagal terhubung' });
    });

    client.on('connect', () => {
      clearTimeout(hardTimeout);
      steps.push({ label: 'Broker MQTT', status: 'ok', detail: `Terhubung ke ${url}`, ms: since(t0) });
      const t1 = performance.now();
      client.subscribe([t.telemetry, t.prediction], (err) => {
        if (err) {
          finish({ label: 'Subscribe topik', status: 'fail', detail: err.message });
          return;
        }
        steps.push({ label: 'Subscribe topik', status: 'ok', detail: `${t.telemetry}, ${t.prediction}`, ms: since(t1) });
        const t2 = performance.now();
        setTimeout(() => {
          const sec = listenMs / 1000;
          if (telemetryCount) {
            const keys = sample ? Object.keys(sample).slice(0, 8).join(', ') : '';
            const devId = sample && typeof sample.device_id === 'string' ? sample.device_id : '?';
            steps.push({
              label: 'Data dari alat',
              status: devId === '?' || devId === s.deviceId ? 'ok' : 'warn',
              detail: `${telemetryCount} pesan dalam ${sec} s (~${Math.round(telemetryCount / sec)} Hz) · device_id=${devId}${devId !== '?' && devId !== s.deviceId ? ` (setting: ${s.deviceId})` : ''} · field: ${keys}`,
              ms: telemetryAt - Math.round(t2),
            });
          } else {
            steps.push({ label: 'Data dari alat', status: 'warn', detail: `Broker OK, tapi tidak ada pesan di ${t.telemetry} selama ${sec} s. ESP32 menyala & topik benar?` });
          }
          steps.push(
            predictionAt
              ? { label: 'Prediksi ML', status: 'ok', detail: `Pesan diterima di ${t.prediction}` }
              : { label: 'Prediksi ML', status: 'skip', detail: 'Belum ada prediksi (layanan ML belum jalan) — tidak wajib' },
          );
          finish();
        }, listenMs);
      });
    });

    client.on('message', (topic, payload) => {
      if (topic === t.telemetry) {
        telemetryCount++;
        if (!sample) {
          sample = parseJson(payload);
          telemetryAt = Math.round(performance.now());
        }
      } else if (topic === t.prediction && !predictionAt) predictionAt = performance.now();
    });
  });
}

/** Firebase: config -> koneksi realtime -> baca data perangkat & model_info. */
export async function testFirebase(s: AppSettings): Promise<TestStep[]> {
  const steps: TestStep[] = [];
  const missing = firebaseMissing(s.firebase);
  if (missing.length) {
    return [{ label: 'Konfigurasi', status: 'fail', detail: `Wajib diisi: ${missing.join(', ')}` }];
  }
  if (!/^https:\/\/.+(firebaseio\.com|firebasedatabase\.app)\/?$/.test(s.firebase.databaseURL.trim())) {
    steps.push({ label: 'Konfigurasi', status: 'warn', detail: 'databaseURL tidak terlihat seperti URL Realtime Database (…firebaseio.com / …firebasedatabase.app)' });
  } else {
    steps.push({ label: 'Konfigurasi', status: 'ok', detail: `Project ${s.firebase.projectId}` });
  }

  let opened: ReturnType<typeof openFirebase>;
  try {
    opened = openFirebase(s.firebase, `sw-test-${Date.now()}`);
  } catch (e) {
    return [...steps, { label: 'Inisialisasi SDK', status: 'fail', detail: String(e) }];
  }
  const { app, db } = opened;
  try {
    const t0 = performance.now();
    const connected = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => { unsub(); resolve(false); }, 7000);
      const unsub = onValue(ref(db, '.info/connected'), (snap) => {
        if (snap.val() === true) { clearTimeout(timer); unsub(); resolve(true); }
      });
    });
    steps.push(connected
      ? { label: 'Koneksi database', status: 'ok', detail: 'Terhubung ke Realtime Database', ms: since(t0) }
      : { label: 'Koneksi database', status: 'fail', detail: 'Tidak tersambung dalam 7 s — cek databaseURL / jaringan' });
    if (!connected) return steps;

    const base = `${s.firebase.rootPath}/${s.deviceId}`;
    const read = async (label: string, path: string, emptyMsg: string, optional = false) => {
      const t1 = performance.now();
      try {
        const snap = await get(ref(db, path));
        if (snap.exists()) {
          const v = snap.val();
          const ts = v && typeof v === 'object' && 'timestamp_ms' in v ? ` · timestamp_ms=${v.timestamp_ms}` : '';
          steps.push({ label, status: 'ok', detail: `/${path} ada${ts}`, ms: since(t1) });
        } else {
          steps.push({ label, status: optional ? 'skip' : 'warn', detail: emptyMsg, ms: since(t1) });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        steps.push({
          label, status: 'fail', ms: since(t1),
          detail: /permission/i.test(msg) ? `Ditolak rules Firebase (permission denied) di /${path}` : msg,
        });
      }
    };
    await read('Data telemetri', `${base}/telemetry/latest`, `Belum ada data di /${base}/telemetry/latest — bridge sudah jalan & device_id benar?`);
    await read('Prediksi ML', `${base}/prediction/latest`, 'Belum ada prediksi — tidak wajib saat ini', true);
    await read('model_info', 'model_info', 'Belum ada model_info dari tim ML — tidak wajib saat ini', true);
    return steps;
  } finally {
    void deleteApp(app);
  }
}
