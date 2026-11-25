// SW-10 Histori — sementara dari event sesi berjalan; filter waktu/sesi menyusul (T26, Firebase)
import { useState } from 'react';
import Card from '../components/Card';
import EventList from '../components/cards/EventList';
import { useDashboard } from '../data/store';
import type { Severity } from '../types/contract';

export default function HistoryPage() {
  const events = useDashboard((s) => s.events);
  const [sev, setSev] = useState<Severity | 'all'>('all');
  const filtered = sev === 'all' ? events : events.filter((e) => e.severity === sev);
  const count = (s: Severity) => events.filter((e) => e.severity === s).length;

  return (
    <div className="content">
      <div className="grid">
        <div className="span-12">
          <Card
            title="Log Event"
            subtitle="Event sesi berjalan (maks 200). Histori lintas sesi akan dibaca dari Firebase."
            right={(['all', 'info', 'warning', 'critical'] as const).map((s) => (
              <button key={s} className={`btn${sev === s ? ' active' : ''}`} onClick={() => setSev(s)}>
                {s === 'all' ? `Semua (${events.length})` : `${s} (${count(s)})`}
              </button>
            ))}
          >
            <div style={{ maxHeight: 'none' }}>
              <EventList events={filtered} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
