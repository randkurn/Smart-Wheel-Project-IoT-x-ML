import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSimulator } from '../../data';
import { useDashboard } from '../../data/store';
import { useFreshness } from '../../hooks/useFreshness';
import type { TerrainClass } from '../../types/contract';

function SimControls() {
  const [, force] = useState(0);
  const simulator = useSimulator();
  if (!simulator) return null;
  const c = simulator.controls;
  const rerender = () => force((n) => n + 1);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="pill info">SIMULATOR</span>
      <select
        className="btn"
        value={c.terrainOverride ?? 'AUTO'}
        title="Paksa jenis lintasan simulator"
        onChange={(e) => {
          simulator!.setTerrain(e.target.value === 'AUTO' ? null : (e.target.value as TerrainClass));
          rerender();
        }}
      >
        <option value="AUTO">Lintasan: siklus otomatis</option>
        <option value="NORMAL">Normal</option>
        <option value="BERGELOMBANG">Bergelombang</option>
        <option value="BERLUBANG">Berlubang</option>
      </select>
      <button
        className={`btn${c.paused ? ' active' : ''}`}
        title="Hentikan pengiriman paket untuk menguji tampilan STALE"
        onClick={() => { simulator!.setPaused(!c.paused); rerender(); }}
      >
        {c.paused ? '▶ Lanjutkan data' : '⏸ Putus data'}
      </button>
      <button
        className={`btn danger${c.estop ? ' active' : ''}`}
        onClick={() => { simulator!.setEstop(!c.estop); rerender(); }}
      >
        {c.estop ? 'Reset E-stop' : 'Simulasi E-stop'}
      </button>
    </div>
  );
}

export default function Topbar({ title }: { title: string }) {
  const { dataStale, offline, ageMs } = useFreshness();
  const conn = useDashboard((s) => s.connection);
  const deviceId = useDashboard((s) => s.telemetry?.device_id);

  const link = offline
    ? <span className="pill bad"><span className="dot" />Offline</span>
    : dataStale
      ? <span className="pill warn blink"><span className="dot" />Stale · {((ageMs ?? 0) / 1000).toFixed(1)} s</span>
      : <span className="pill ok"><span className="dot" />Online</span>;

  return (
    <header className="topbar">
      <h1>{title}</h1>
      {link}
      <span className="pill off mono">{deviceId ?? '—'}</span>
      <Link to="/settings" title="Atur koneksi" style={{ display: 'flex', gap: 6 }}>
        <span className={`pill ${conn.mqtt ? 'ok' : 'off'}`}>MQTT</span>
        <span className={`pill ${conn.firebase ? 'ok' : 'off'}`}>Firebase</span>
        {conn.error && <span className="pill bad" title={conn.error}>! Koneksi</span>}
      </Link>
      <div className="spacer" />
      <SimControls />
    </header>
  );
}
