// SW-08 Info model, device & sistem
import { Fragment } from 'react';
import { CONFIG } from '../../config';
import { useDashboard } from '../../data/store';
import Card from '../Card';

const DEVICES = [
  ['MCU utama', 'ESP32 DevKit (WROOM-32)'],
  ['Remote', 'ESP32 + joystick · ESP-NOW'],
  ['IMU', '2× MPU6050 (rangka + dudukan)'],
  ['Jarak', 'Sensor ToF (tipe menunggu T03)'],
  ['Penggerak', '2× motor DC 6 V + encoder · DRV8833'],
  ['Beban', '4× FSR dudukan'],
  ['Catu', 'Li-ion 2S 7,4 V + BMS · E-stop fisik'],
];

export default function SystemInfoPanel() {
  const m = useDashboard((s) => s.modelInfo);
  const conn = useDashboard((s) => s.connection);
  const t = useDashboard((s) => s.telemetry);

  return (
    <Card title="Model · Device · Sistem" subtitle="Konfigurasi yang sedang dipakai">
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 600 }}>MODEL</div>
        {m ? (
          <dl className="kv">
            <dt>Nama</dt><dd>{m.name}</dd>
            <dt>Versi</dt><dd className="mono">{m.version}</dd>
            <dt>Algoritma</dt><dd>{m.algorithm}</dd>
            <dt>Jendela / step</dt><dd className="mono">{m.window_s} s / {m.step_s} s</dd>
            <dt>Latensi inferensi</dt><dd className="mono">{m.inference_latency_ms == null ? '—' : `${m.inference_latency_ms} ms`}</dd>
            <dt>Fitur</dt><dd style={{ fontSize: 12 }}>{m.features.join(', ')}</dd>
          </dl>
        ) : (
          <div className="empty" style={{ padding: 14 }}>model_info belum tersedia dari tim ML</div>
        )}
      </div>
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 600 }}>DEVICE</div>
        <dl className="kv">
          <dt>device_id</dt><dd className="mono">{t?.device_id ?? CONFIG.deviceId}</dd>
          {DEVICES.map(([k, v]) => (<Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>))}
        </dl>
      </div>
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 600 }}>SISTEM</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="pill info">Sumber: {conn.source}</span>
          <span className={`pill ${conn.mqtt ? 'ok' : 'off'}`}><span className="dot" />MQTT</span>
          <span className={`pill ${conn.firebase ? 'ok' : 'off'}`}><span className="dot" />Firebase</span>
          <span className="pill off">Stale &gt; {CONFIG.staleMs / 1000} s</span>
          <span className="pill off">IMU 100 Hz → {CONFIG.displayHz} Hz</span>
        </div>
      </div>
    </Card>
  );
}
