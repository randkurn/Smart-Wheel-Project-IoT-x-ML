// Halaman Setting — sumber data, koneksi alat (MQTT), database (Firebase), dan cek koneksi.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Card from '../components/Card';
import { startDataSource } from '../data';
import { testFirebase, testMqtt, type TestStep } from '../data/connectionTest';
import { useDashboard } from '../data/store';
import { useFreshness } from '../hooks/useFreshness';
import {
  DEFAULT_SETTINGS, resetSettings, saveSettings, topics, useSettings,
  type AppSettings, type DataSourceKind, type FirebaseSettings, type MqttSettings,
} from '../settings';

const SOURCES: { id: DataSourceKind; name: string; desc: string }[] = [
  { id: 'simulator', name: 'Simulator', desc: 'Data tiruan di browser. Untuk pengembangan tanpa alat.' },
  { id: 'mqtt', name: 'Alat (MQTT langsung)', desc: 'Subscribe ke broker lewat WebSocket. Paling real-time, untuk demo di jaringan lokal.' },
  { id: 'firebase', name: 'Database (Firebase)', desc: 'Membaca data yang ditulis bridge ke Realtime Database. Bisa diakses dari mana saja.' },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

const ICON: Record<TestStep['status'], string> = { ok: '✓', warn: '!', fail: '✕', skip: '–' };

function TestResult({ steps, running }: { steps: TestStep[] | null; running: boolean }) {
  if (running) return <div className="test-box"><span className="spinner" /> Mengecek koneksi…</div>;
  if (!steps) return null;
  const worst = steps.some((s) => s.status === 'fail') ? 'fail' : steps.some((s) => s.status === 'warn') ? 'warn' : 'ok';
  const summary = { ok: 'Koneksi berhasil', warn: 'Terhubung, tapi ada yang perlu dicek', fail: 'Koneksi gagal' }[worst];
  return (
    <div className={`test-box ${worst}`}>
      <div className="test-summary">{summary}</div>
      {steps.map((s, i) => (
        <div className="test-step" key={i}>
          <span className={`test-icon ${s.status}`}>{ICON[s.status]}</span>
          <div>
            <div style={{ fontWeight: 600 }}>
              {s.label}
              {s.ms != null && <span className="dim mono" style={{ fontWeight: 400, marginLeft: 8 }}>{s.ms} ms</span>}
            </div>
            <div className="muted" style={{ fontSize: 12, wordBreak: 'break-word' }}>{s.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ambil nilai dari potongan `const firebaseConfig = { apiKey: "...", ... }` di Firebase console. */
function parseFirebaseSnippet(text: string): Partial<FirebaseSettings> {
  const out: Partial<FirebaseSettings> = {};
  for (const k of ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'] as const) {
    const m = text.match(new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`));
    if (m) out[k] = m[1];
  }
  return out;
}

function ActiveStatus() {
  const conn = useDashboard((s) => s.connection);
  const { ageMs, dataStale, offline } = useFreshness();
  const name = SOURCES.find((s) => s.id === conn.source)?.name ?? conn.source;
  const linkUp = conn.source === 'simulator' ? true : conn.source === 'mqtt' ? conn.mqtt : conn.firebase;
  return (
    <Card title="Koneksi aktif" subtitle="Status sumber data yang sedang dipakai dashboard">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="pill info">{name}</span>
        <span className={`pill ${linkUp ? 'ok' : 'bad'}`}><span className="dot" />{conn.source === 'firebase' ? 'Database' : conn.source === 'mqtt' ? 'Broker' : 'Simulator'} {linkUp ? 'terhubung' : 'terputus'}</span>
        <span className={`pill ${offline ? 'bad' : dataStale ? 'warn' : 'ok'}`}>
          <span className="dot" />{ageMs == null ? 'Belum ada data' : `Data terakhir ${(Math.max(0, ageMs) / 1000).toFixed(1)} s lalu`}
        </span>
      </div>
      {conn.error && <div className="alert">{conn.error}</div>}
    </Card>
  );
}

export default function SettingsPage() {
  const saved = useSettings();
  const [draft, setDraft] = useState<AppSettings>(saved);
  const [showPass, setShowPass] = useState(false);
  const [snippet, setSnippet] = useState('');
  const [mqttRes, setMqttRes] = useState<TestStep[] | null>(null);
  const [fbRes, setFbRes] = useState<TestStep[] | null>(null);
  const [running, setRunning] = useState<'mqtt' | 'firebase' | null>(null);
  const [flash, setFlash] = useState('');

  useEffect(() => setDraft(saved), [saved]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const setMqtt = (p: Partial<MqttSettings>) => setDraft((d) => ({ ...d, mqtt: { ...d.mqtt, ...p } }));
  const setFb = (p: Partial<FirebaseSettings>) => setDraft((d) => ({ ...d, firebase: { ...d.firebase, ...p } }));
  const t = topics(draft.mqtt.topicPrefix || 'smartwheel');

  const runMqtt = async () => {
    setRunning('mqtt'); setMqttRes(null);
    setMqttRes(await testMqtt(draft));
    setRunning(null);
  };
  const runFb = async () => {
    setRunning('firebase'); setFbRes(null);
    setFbRes(await testFirebase(draft));
    setRunning(null);
  };
  const apply = () => {
    saveSettings(draft);
    startDataSource(draft);
    setFlash('Tersimpan. Dashboard memakai pengaturan baru.');
    setTimeout(() => setFlash(''), 3000);
  };

  return (
    <div className="content">
      <div className="grid">
        <div className="span-12"><ActiveStatus /></div>

        <div className="span-12">
          <Card title="Sumber data" subtitle="Dari mana dashboard membaca data">
            <div className="source-grid">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`source-opt${draft.source === s.id ? ' active' : ''}`}
                  onClick={() => setDraft((d) => ({ ...d, source: s.id }))}
                >
                  <span className="radio" />
                  <span>
                    <span style={{ fontWeight: 650, display: 'block' }}>{s.name}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{s.desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <Field label="Device ID" hint="Harus sama dengan device_id yang dikirim ESP32 dan path di Firebase">
              <input className="input mono" value={draft.deviceId} onChange={(e) => setDraft((d) => ({ ...d, deviceId: e.target.value }))} />
            </Field>
          </Card>
        </div>

        <div className="span-6">
          <Card
            title="Koneksi alat · MQTT"
            subtitle="Broker yang menerima telemetri ESP32"
            right={draft.source === 'mqtt' && <span className="pill info">dipakai</span>}
          >
            <Field label="URL broker (WebSocket)" hint="Browser hanya bisa MQTT lewat WebSocket, mis. ws://192.168.1.10:9001 atau wss://…:8884/mqtt">
              <input className="input mono" placeholder="ws://192.168.1.10:9001" value={draft.mqtt.url} onChange={(e) => setMqtt({ url: e.target.value })} />
            </Field>
            <div className="field-row">
              <Field label="Username">
                <input className="input" autoComplete="off" value={draft.mqtt.username} onChange={(e) => setMqtt({ username: e.target.value })} />
              </Field>
              <Field label="Password">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" type={showPass ? 'text' : 'password'} autoComplete="new-password" value={draft.mqtt.password} onChange={(e) => setMqtt({ password: e.target.value })} />
                  <button type="button" className="btn" onClick={() => setShowPass((v) => !v)}>{showPass ? 'Sembunyi' : 'Lihat'}</button>
                </div>
              </Field>
            </div>
            <div className="field-row">
              <Field label="Prefix topik">
                <input className="input mono" value={draft.mqtt.topicPrefix} onChange={(e) => setMqtt({ topicPrefix: e.target.value })} />
              </Field>
              <Field label="Client ID" hint="Kosongkan untuk acak">
                <input className="input mono" placeholder="otomatis" value={draft.mqtt.clientId} onChange={(e) => setMqtt({ clientId: e.target.value })} />
              </Field>
            </div>
            <div className="topic-list mono">
              {Object.entries(t).map(([k, v]) => <div key={k}><span className="dim">{k.padEnd(10)}</span> {v}</div>)}
            </div>
            <div className="dim" style={{ fontSize: 12 }}>
              Kredensial disimpan hanya di browser ini. Pakai akun broker yang hanya boleh subscribe.
            </div>
            <div>
              <button type="button" className="btn primary" disabled={running !== null} onClick={runMqtt}>Cek koneksi MQTT</button>
            </div>
            <TestResult steps={mqttRes} running={running === 'mqtt'} />
          </Card>
        </div>

        <div className="span-6">
          <Card
            title="Database · Firebase"
            subtitle="Realtime Database yang diisi bridge"
            right={draft.source === 'firebase' && <span className="pill info">dipakai</span>}
          >
            <Field label="Tempel firebaseConfig (opsional)" hint="Salin dari Firebase console → Project settings → Your apps, lalu klik Isi otomatis">
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <textarea className="input mono" rows={2} placeholder='apiKey: "…", databaseURL: "…", …' value={snippet} onChange={(e) => setSnippet(e.target.value)} />
                <button type="button" className="btn" disabled={!snippet.trim()} onClick={() => { setFb(parseFirebaseSnippet(snippet)); setSnippet(''); }}>Isi otomatis</button>
              </div>
            </Field>
            <Field label="databaseURL *">
              <input className="input mono" placeholder="https://xxx-default-rtdb.asia-southeast1.firebasedatabase.app" value={draft.firebase.databaseURL} onChange={(e) => setFb({ databaseURL: e.target.value })} />
            </Field>
            <div className="field-row">
              <Field label="apiKey *">
                <input className="input mono" autoComplete="off" value={draft.firebase.apiKey} onChange={(e) => setFb({ apiKey: e.target.value })} />
              </Field>
              <Field label="projectId *">
                <input className="input mono" value={draft.firebase.projectId} onChange={(e) => setFb({ projectId: e.target.value })} />
              </Field>
            </div>
            <div className="field-row">
              <Field label="authDomain">
                <input className="input mono" value={draft.firebase.authDomain} onChange={(e) => setFb({ authDomain: e.target.value })} />
              </Field>
              <Field label="appId">
                <input className="input mono" value={draft.firebase.appId} onChange={(e) => setFb({ appId: e.target.value })} />
              </Field>
            </div>
            <Field label="Root path data" hint={`Dashboard membaca /${draft.firebase.rootPath || 'devices'}/${draft.deviceId}/telemetry/latest, …/prediction/latest, …/events`}>
              <input className="input mono" value={draft.firebase.rootPath} onChange={(e) => setFb({ rootPath: e.target.value })} />
            </Field>
            <div>
              <button type="button" className="btn primary" disabled={running !== null} onClick={runFb}>Cek koneksi database</button>
            </div>
            <TestResult steps={fbRes} running={running === 'firebase'} />
          </Card>
        </div>

        <div className="span-12">
          <div className="save-bar">
            <span className="muted">
              {flash || (dirty ? 'Ada perubahan yang belum disimpan.' : 'Semua pengaturan tersimpan.')}
            </span>
            <div className="spacer" />
            <button type="button" className="btn" onClick={() => { if (confirm('Kembalikan semua pengaturan ke nilai default (.env)?')) { resetSettings(); startDataSource(DEFAULT_SETTINGS); } }}>Reset ke default</button>
            <button type="button" className="btn" disabled={!dirty} onClick={() => setDraft(saved)}>Batalkan</button>
            <button type="button" className="btn primary" disabled={!dirty} onClick={apply}>Simpan &amp; terapkan</button>
          </div>
        </div>
      </div>
    </div>
  );
}
