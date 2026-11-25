// SW-06 ToF — nilai jarak + visual radar + zona aman/waspada/berhenti.
// Mode sweep (servo ±60°). Untuk ToF 1 titik, tof_angle_deg = null -> hanya titik di 0°.
import { CONFIG, ZONE_META } from '../../config';
import { useDashboard } from '../../data/store';
import { useFreshness } from '../../hooks/useFreshness';
import Card from '../Card';

const W = 320;
const H = 190;
const CX = W / 2;
const CY = H - 14;
const R = 165; // px untuk jarak maksimum
const SPAN = 60; // derajat ke kiri/kanan

const mmToPx = (mm: number) => (Math.min(mm, CONFIG.tof.maxRangeMm) / CONFIG.tof.maxRangeMm) * R;
const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
};
function sector(r0: number, r1: number) {
  const [x0, y0] = polar(-SPAN, r1);
  const [x1, y1] = polar(SPAN, r1);
  const [x2, y2] = polar(SPAN, r0);
  const [x3, y3] = polar(-SPAN, r0);
  return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3} Z`;
}

export default function TofRadar() {
  const t = useDashboard((s) => s.telemetry);
  const sweep = useDashboard((s) => s.tofSweep);
  const { dataStale } = useFreshness();
  const zone = t?.tof_zone ?? 'INVALID';
  const angle = t?.tof_angle_deg ?? 0;

  // jarak terdekat di kerucut depan (±15°) dari sweep terbaru
  const front = sweep.filter((p) => Math.abs(p.angle) <= 15 && p.mm != null).map((p) => p.mm!);
  const frontMin = front.length ? Math.min(...front) : null;
  const frontZone = frontMin == null ? 'INVALID' : frontMin <= CONFIG.tof.stopMm ? 'BERHENTI' : frontMin <= CONFIG.tof.safeMm ? 'WASPADA' : 'AMAN';
  const zm = ZONE_META[frontZone];
  const rings = [250, 500, 1000, 1500, 2000];
  const latest = t?.timestamp_ms ?? 0;

  return (
    <Card
      title="Sensor ToF · Radar"
      subtitle="Jarak hambatan depan"
      stale={t != null && dataStale}
      right={<span className="pill" style={{ color: zm.color, borderColor: zm.color }}><span className="dot" />{zm.label}</span>}
    >
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <path d={sector(mmToPx(CONFIG.tof.safeMm), R)} fill="rgba(34,197,94,0.07)" />
        <path d={sector(mmToPx(CONFIG.tof.stopMm), mmToPx(CONFIG.tof.safeMm))} fill="rgba(245,158,11,0.16)" />
        <path d={sector(0.01, mmToPx(CONFIG.tof.stopMm))} fill="rgba(239,68,68,0.22)" />
        {rings.map((mm) => {
          const r = mmToPx(mm);
          const [x0, y0] = polar(-SPAN, r);
          const [x1, y1] = polar(SPAN, r);
          const [lx, ly] = polar(SPAN + 4, r);
          return (
            <g key={mm}>
              <path d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" stroke="#2a3547" />
              <text x={lx} y={ly} fontSize="8" fill="#5d6b80" textAnchor="start">{mm >= 1000 ? `${mm / 1000} m` : `${mm / 10} cm`}</text>
            </g>
          );
        })}
        {[-60, -30, 0, 30, 60].map((d) => {
          const [x, y] = polar(d, R);
          return <line key={d} x1={CX} y1={CY} x2={x} y2={y} stroke="#2a3547" strokeDasharray={d === 0 ? undefined : '2 3'} />;
        })}
        {/* garis sweep */}
        {t?.tof_angle_deg != null && (() => {
          const [x, y] = polar(angle, R);
          return <line x1={CX} y1={CY} x2={x} y2={y} stroke="#38bdf8" strokeWidth="1.5" opacity="0.8" />;
        })()}
        {/* titik deteksi, memudar sesuai umur */}
        {sweep.map((p) => {
          if (p.mm == null) return null;
          const [x, y] = polar(p.angle, mmToPx(p.mm));
          const age = Math.max(0, latest - p.t);
          const z = p.mm <= CONFIG.tof.stopMm ? 'BERHENTI' : p.mm <= CONFIG.tof.safeMm ? 'WASPADA' : 'AMAN';
          const atMax = p.mm >= CONFIG.tof.maxRangeMm - 20;
          return (
            <circle key={p.angle} cx={x} cy={y} r={atMax ? 1.5 : 3.2}
              fill={atMax ? '#5d6b80' : ZONE_META[z].color} opacity={Math.max(0.15, 1 - age / 4000)} />
          );
        })}
        {/* kursi roda */}
        <rect x={CX - 12} y={CY - 4} width="24" height="16" rx="3" fill="#cbd5e1" />
        <rect x={CX - 9} y={CY - 8} width="18" height="5" rx="2" fill="#4fb3a3" />
      </svg>

      <div className="stat-row">
        <div className="stat">
          <div className="label">Terdekat depan</div>
          <div className="value mono" style={{ color: zm.color }}>
            {frontMin == null ? '—' : (frontMin / 10).toFixed(1)}<span className="unit">cm</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">Bacaan · {angle}°</div>
          <div className="value mono" style={{ color: ZONE_META[zone].color }}>
            {t?.tof_mm == null ? 'invalid' : (t.tof_mm / 10).toFixed(1)}{t?.tof_mm != null && <span className="unit">cm</span>}
          </div>
        </div>
      </div>
      <div className="dim" style={{ fontSize: 11 }}>
        Zona: berhenti ≤ {CONFIG.tof.stopMm / 10} cm · waspada ≤ {CONFIG.tof.safeMm / 10} cm · aman &gt; {CONFIG.tof.safeMm / 10} cm (nilai awal)
      </div>
    </Card>
  );
}
