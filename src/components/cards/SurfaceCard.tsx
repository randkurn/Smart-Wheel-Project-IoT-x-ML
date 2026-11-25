// SW-01 Kondisi permukaan — kelas + confidence + umur data
import { CONFIG, TERRAIN_META } from '../../config';
import { useDashboard } from '../../data/store';
import { useFreshness } from '../../hooks/useFreshness';
import type { TerrainClass } from '../../types/contract';
import Card from '../Card';

const ORDER: TerrainClass[] = ['NORMAL', 'BERGELOMBANG', 'BERLUBANG'];

export default function SurfaceCard() {
  const pred = useDashboard((s) => s.prediction);
  const { predStale, predAgeMs } = useFreshness();
  const meta = pred ? TERRAIN_META[pred.terrain_class] : null;
  const isDummy = pred?.model_version.startsWith('sim');
  const lowConf = pred != null && pred.confidence < 0.6;

  return (
    <Card
      title="Kondisi Permukaan"
      subtitle="Prediksi kelas lintasan"
      stale={pred != null && predStale}
      right={isDummy && <span className="pill off">dummy</span>}
    >
      {!pred || !meta ? (
        <div className="empty">Menunggu prediksi…</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 54, height: 54, borderRadius: 12, flex: 'none',
                background: `${meta.color}22`, border: `2px solid ${meta.color}`,
                display: 'grid', placeItems: 'center',
              }}
            >
              <TerrainIcon kind={pred.terrain_class} color={meta.color} />
            </div>
            <div>
              <div className="big" style={{ color: predStale ? 'var(--muted)' : meta.color, fontSize: 24 }}>
                {predStale ? 'Prediksi kedaluwarsa' : meta.label}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {meta.desc} · cap {CONFIG.speedCapPct[pred.terrain_class]}%
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span className="muted">Confidence</span>
              <span className="mono" style={{ color: lowConf ? 'var(--warn)' : undefined }}>
                {(pred.confidence * 100).toFixed(1)}%{lowConf && ' · rendah'}
              </span>
            </div>
            <div className="bar">
              <span style={{ width: `${pred.confidence * 100}%`, background: lowConf ? 'var(--warn)' : meta.color }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {ORDER.map((k) => (
              <span
                key={k}
                className="pill"
                style={k === pred.terrain_class && !predStale
                  ? { color: TERRAIN_META[k].color, borderColor: TERRAIN_META[k].color }
                  : { color: 'var(--dim)' }}
              >
                {TERRAIN_META[k].label.split(' ')[0]}
              </span>
            ))}
          </div>

          <dl className="kv">
            <dt>Umur prediksi</dt>
            <dd className="mono">{predAgeMs == null ? '—' : `${(predAgeMs / 1000).toFixed(1)} s`}</dd>
            <dt>Model</dt>
            <dd className="mono">{pred.model_version}</dd>
          </dl>
        </>
      )}
    </Card>
  );
}

function TerrainIcon({ kind, color }: { kind: TerrainClass; color: string }) {
  const d =
    kind === 'NORMAL'
      ? 'M4 20 H32'
      : kind === 'BERGELOMBANG'
        ? 'M4 20 Q8 12 12 20 T20 20 T28 20 T36 20'
        : 'M4 16 H12 Q14 26 18 26 Q22 26 24 16 H32';
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
      <path d={d} />
    </svg>
  );
}
