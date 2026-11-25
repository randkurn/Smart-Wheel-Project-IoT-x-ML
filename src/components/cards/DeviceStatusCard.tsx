// SW-04 Status perangkat — online/offline, stale, mode, sensor_ok, buzzer, imbalance
import { useDashboard } from '../../data/store';
import { useFreshness } from '../../hooks/useFreshness';
import Card from '../Card';

type Tone = 'ok' | 'warn' | 'bad' | 'off';
function Row({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="muted">{label}</span>
      <span className={`pill ${tone}`}><span className="dot" />{value}</span>
    </div>
  );
}

function SeatMap() {
  const seat = useDashboard((s) => s.seat);
  if (!seat) return null;
  const vals = [seat.pressure_fl, seat.pressure_fr, seat.pressure_rl, seat.pressure_rr];
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const names = ['Depan-kiri', 'Depan-kanan', 'Belakang-kiri', 'Belakang-kanan'];
  return (
    <div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Distribusi beban dudukan (FSR)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {vals.map((v, i) => {
          const r = v / total;
          const hot = Math.abs(r - 0.25) > 0.07;
          return (
            <div key={i} className="stat" style={{ padding: '6px 9px', borderColor: hot ? 'var(--warn)' : undefined, background: `rgba(56,189,248,${r * 0.6})` }}>
              <div className="label">{names[i]}</div>
              <div className="mono" style={{ fontWeight: 700 }}>{(r * 100).toFixed(0)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DeviceStatusCard() {
  const t = useDashboard((s) => s.telemetry);
  const c = useDashboard((s) => s.control);
  const seat = useDashboard((s) => s.seat);
  const { offline, dataStale, ageMs, predStale } = useFreshness();

  const mode = c?.mode ?? 'NORMAL';
  const modeTone: Tone = mode === 'E_STOP' ? 'bad' : mode === 'PROTEKSI' ? 'warn' : 'ok';

  return (
    <Card title="Status Perangkat" subtitle={t ? `Trial ${t.trial_id}` : 'ESP32 utama'}>
      <div>
        <Row label="Koneksi" value={offline ? 'Offline' : dataStale ? 'Stale' : 'Online'} tone={offline ? 'bad' : dataStale ? 'warn' : 'ok'} />
        <Row label="Data terakhir" value={ageMs == null ? '—' : `${(ageMs / 1000).toFixed(1)} s lalu`} tone={dataStale ? 'warn' : 'ok'} />
        <Row label="Mode" value={mode.replace('_', '-')} tone={modeTone} />
        <Row label="Prediksi ML" value={predStale ? 'Stale' : 'Valid'} tone={predStale ? 'warn' : 'ok'} />
        <Row label="Sensor IMU" value={t?.sensor_ok ? 'OK' : 'Error'} tone={t?.sensor_ok ? 'ok' : 'bad'} />
        <Row label="Sensor ToF" value={t?.tof_ok ? 'OK' : 'Invalid'} tone={t?.tof_ok ? 'ok' : 'warn'} />
        <Row label="Remote" value={c?.remote_link ? 'Terhubung' : 'Putus'} tone={c?.remote_link ? 'ok' : 'bad'} />
        <Row label="Buzzer" value={c?.buzzer ? 'Bunyi' : 'Diam'} tone={c?.buzzer ? 'warn' : 'off'} />
        <Row label="Beban dudukan" value={seat?.imbalance_flag ? 'Tidak seimbang' : 'Seimbang'} tone={seat?.imbalance_flag ? 'warn' : 'ok'} />
      </div>
      <SeatMap />
    </Card>
  );
}
