// SW-02 Kecepatan motor — RPM kiri/kanan aktual vs target + cap % aktif
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CONFIG } from '../../config';
import { useDashboard } from '../../data/store';
import { useFreshness } from '../../hooks/useFreshness';
import Card from '../Card';

function WheelBar({ label, actual, target }: { label: string; actual: number; target: number | null }) {
  const pct = (v: number) => `${Math.min(100, (Math.abs(v) / CONFIG.maxRpm) * 100)}%`;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>{label}</span>
        <span>
          <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{actual.toFixed(0)}</span>
          <span className="unit">RPM</span>
          <span className="dim mono" style={{ fontSize: 12, marginLeft: 8 }}>target {target == null ? '—' : target.toFixed(0)}</span>
        </span>
      </div>
      <div className="bar">
        <span style={{ width: pct(actual), background: 'var(--accent)' }} />
        {target != null && <i className="marker" style={{ left: pct(target) }} />}
      </div>
    </div>
  );
}

export default function MotorSpeedCard() {
  const t = useDashboard((s) => s.telemetry);
  const c = useDashboard((s) => s.control);
  const hist = useDashboard((s) => s.rpmHistory);
  const { dataStale } = useFreshness();
  const cap = c?.speed_cap_pct ?? 0;
  const capColor = !c ? 'var(--muted)' : cap === 0 ? 'var(--bad)' : cap < 100 ? 'var(--warn)' : 'var(--ok)';
  const chart = hist.slice(-150).map((p) => ({ ...p, s: p.t / 1000 }));

  return (
    <Card
      title="Kecepatan Motor"
      subtitle={`Encoder · maks ${CONFIG.maxRpm} RPM`}
      stale={t != null && dataStale}
      right={<span className="pill" style={{ color: capColor, borderColor: capColor }}>Cap {c ? `${cap}%` : '—'}</span>}
    >
      {!t ? (
        <div className="empty">Menunggu telemetri…</div>
      ) : (
        <>
          <WheelBar label="Roda kiri" actual={t.rpm_left} target={c?.target_rpm_l ?? null} />
          <WheelBar label="Roda kanan" actual={t.rpm_right} target={c?.target_rpm_r ?? null} />
          <div style={{ height: 110 }}>
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="s" hide />
                <YAxis domain={[0, CONFIG.maxRpm]} tick={{ fontSize: 10, fill: '#5d6b80' }} />
                <Tooltip formatter={(v: number) => v.toFixed(1)} labelFormatter={(l: number) => `t = ${l.toFixed(1)} s`} />
                <Line dataKey="targetL" name="Target L" stroke="#64748b" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                <Line dataKey="left" name="Aktual L" stroke="#38bdf8" dot={false} isAnimationActive={false} strokeWidth={2} />
                <Line dataKey="right" name="Aktual R" stroke="#a78bfa" dot={false} isAnimationActive={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="dim" style={{ fontSize: 11 }}>
            <span style={{ color: '#38bdf8' }}>━</span> kiri &nbsp;
            <span style={{ color: '#a78bfa' }}>━</span> kanan &nbsp;
            <span style={{ color: '#64748b' }}>┅</span> target kiri &nbsp;· 15 s terakhir
          </div>
        </>
      )}
    </Card>
  );
}
