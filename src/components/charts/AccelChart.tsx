// SW-05 Accelerometer XYZ — nilai numerik + grafik real-time, buffer 30 s
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CONFIG } from '../../config';
import { useDashboard } from '../../data/store';
import { useFreshness } from '../../hooks/useFreshness';
import Card from '../Card';

const AXES = [
  { key: 'ax', label: 'aX', color: 'var(--x)', hex: '#f87171' },
  { key: 'ay', label: 'aY', color: 'var(--y)', hex: '#4ade80' },
  { key: 'az', label: 'aZ', color: 'var(--z)', hex: '#60a5fa' },
] as const;

export default function AccelChart() {
  const t = useDashboard((s) => s.telemetry);
  const hist = useDashboard((s) => s.accelHistory);
  const { dataStale } = useFreshness();
  const [visible, setVisible] = useState({ ax: true, ay: true, az: true });
  const data = hist.map((p) => ({ ...p, s: p.t / 1000 }));

  return (
    <Card
      title="Accelerometer XYZ"
      subtitle={`MPU6050 rangka · ${CONFIG.accelBufferS} s terakhir · ${CONFIG.displayHz} Hz (downsample dari 100 Hz)`}
      stale={t != null && dataStale}
      right={AXES.map((a) => (
        <button
          key={a.key}
          className={`btn${visible[a.key] ? ' active' : ''}`}
          style={visible[a.key] ? { color: a.hex, borderColor: a.hex, background: 'transparent' } : undefined}
          onClick={() => setVisible((v) => ({ ...v, [a.key]: !v[a.key] }))}
        >
          {a.label}
        </button>
      ))}
    >
      {!t ? (
        <div className="empty">Menunggu telemetri…</div>
      ) : (
        <>
          <div className="stat-row">
            {AXES.map((a) => (
              <div className="stat" key={a.key} style={{ borderLeft: `3px solid ${a.hex}` }}>
                <div className="label">{a.label}</div>
                <div className="value mono">{t.imu[a.key].toFixed(2)}<span className="unit">m/s²</span></div>
              </div>
            ))}
            <div className="stat">
              <div className="label">Gyro X/Y/Z</div>
              <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>
                {t.imu.gx.toFixed(1)} / {t.imu.gy.toFixed(1)} / {t.imu.gz.toFixed(1)}<span className="unit">°/s</span>
              </div>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="#2a3547" strokeDasharray="3 3" />
                <XAxis
                  dataKey="s" type="number" domain={['dataMin', 'dataMax']}
                  tickFormatter={(v: number) => `${v.toFixed(0)}s`} tick={{ fontSize: 10, fill: '#5d6b80' }}
                />
                <YAxis domain={[-4, 16]} tick={{ fontSize: 10, fill: '#5d6b80' }} />
                <Tooltip formatter={(v: number) => v.toFixed(3)} labelFormatter={(l: number) => `t = ${l.toFixed(1)} s`} />
                {AXES.map((a) =>
                  visible[a.key] ? (
                    <Line key={a.key} dataKey={a.key} name={a.label} stroke={a.hex} dot={false} strokeWidth={1.6} isAnimationActive={false} />
                  ) : null,
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
