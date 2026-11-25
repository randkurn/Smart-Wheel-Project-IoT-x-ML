// SW-03 Getaran — RMS & peak percepatan dinamis (window 1 s) + tren waktu
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboard } from '../../data/store';
import { useFreshness } from '../../hooks/useFreshness';
import Card from '../Card';

export default function VibrationPanel() {
  const t = useDashboard((s) => s.telemetry);
  const hist = useDashboard((s) => s.vibHistory);
  const { dataStale } = useFreshness();
  const data = hist.map((p) => ({ ...p, s: p.t / 1000 }));
  const maxRms = hist.reduce((m, p) => Math.max(m, p.rms), 0);

  return (
    <Card title="Getaran" subtitle="Percepatan dinamis · jendela 1 s" stale={t != null && dataStale}>
      {!t ? (
        <div className="empty">Menunggu telemetri…</div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <div className="label">RMS</div>
              <div className="value mono">{t.vib.rms.toFixed(2)}<span className="unit">m/s²</span></div>
            </div>
            <div className="stat">
              <div className="label">Peak</div>
              <div className="value mono">{t.vib.peak.toFixed(2)}<span className="unit">m/s²</span></div>
            </div>
            <div className="stat">
              <div className="label">RMS maks 30 s</div>
              <div className="value mono">{maxRms.toFixed(2)}</div>
            </div>
          </div>
          <div style={{ height: 170 }}>
            <ResponsiveContainer>
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="gPeak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRms" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="s" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => `${v.toFixed(0)}s`} tick={{ fontSize: 10, fill: '#5d6b80' }} />
                <YAxis tick={{ fontSize: 10, fill: '#5d6b80' }} />
                <Tooltip formatter={(v: number) => v.toFixed(3)} labelFormatter={(l: number) => `t = ${l.toFixed(1)} s`} />
                <Area dataKey="peak" name="Peak" stroke="#f59e0b" fill="url(#gPeak)" isAnimationActive={false} />
                <Area dataKey="rms" name="RMS" stroke="#38bdf8" fill="url(#gRms)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
