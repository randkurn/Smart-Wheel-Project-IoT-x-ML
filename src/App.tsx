import { Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import MlEvalPage from './pages/MlEvalPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <Routes>
          <Route path="/" element={<><Topbar title="Dashboard Monitoring" /><DashboardPage /></>} />
          <Route path="/ml" element={<><Topbar title="Evaluasi Model ML" /><MlEvalPage /></>} />
          <Route path="/history" element={<><Topbar title="Histori & Event" /><HistoryPage /></>} />
          <Route path="/settings" element={<><Topbar title="Setting Koneksi" /><SettingsPage /></>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
