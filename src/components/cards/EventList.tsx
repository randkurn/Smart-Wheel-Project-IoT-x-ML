import type { DeviceEvent } from '../../types/contract';

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0').slice(0, 1)}`;
};

export default function EventList({ events, max }: { events: DeviceEvent[]; max?: number }) {
  const list = max ? events.slice(0, max) : events;
  if (!list.length) return <div className="empty">Belum ada event</div>;
  return (
    <div className="events">
      {list.map((e) => (
        <div className="event" key={e.event_id}>
          <span className="mono dim">{fmt(e.timestamp_ms)}</span>
          <span className={`sev ${e.severity}`}>{e.severity}</span>
          <span className="mono muted" style={{ fontSize: 12 }}>{e.type}</span>
          <span>{e.message}</span>
        </div>
      ))}
    </div>
  );
}
