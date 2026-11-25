import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card';
import AccelChart from '../components/charts/AccelChart';
import DeviceStatusCard from '../components/cards/DeviceStatusCard';
import EventList from '../components/cards/EventList';
import MotorSpeedCard from '../components/cards/MotorSpeedCard';
import SurfaceCard from '../components/cards/SurfaceCard';
import SystemInfoPanel from '../components/cards/SystemInfoPanel';
import VibrationPanel from '../components/cards/VibrationPanel';
import TofRadar from '../components/visual/TofRadar';
import { useDashboard } from '../data/store';

// Three.js cukup berat — dimuat terpisah
const Wheelchair3D = lazy(() => import('../components/visual/Wheelchair3D'));

export default function DashboardPage() {
  const events = useDashboard((s) => s.events);
  return (
    <div className="content">
      <div className="grid">
        <div className="span-4"><SurfaceCard /></div>
        <div className="span-4"><MotorSpeedCard /></div>
        <div className="span-4"><DeviceStatusCard /></div>

        <div className="span-8"><AccelChart /></div>
        <div className="span-4"><VibrationPanel /></div>

        <div className="span-4"><TofRadar /></div>
        <div className="span-4">
          <Suspense fallback={<Card title="Visual 3D Kursi Roda"><div className="empty">Memuat 3D…</div></Card>}>
            <Wheelchair3D />
          </Suspense>
        </div>
        <div className="span-4"><SystemInfoPanel /></div>

        <div className="span-12">
          <Card title="Event Terbaru" right={<Link to="/history" className="btn">Lihat histori →</Link>}>
            <EventList events={events} max={8} />
          </Card>
        </div>
      </div>
    </div>
  );
}
