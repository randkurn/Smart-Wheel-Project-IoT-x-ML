import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', icon: '◧' },
  { to: '/ml', label: 'ML Evaluasi', icon: '◩' },
  { to: '/history', label: 'Histori', icon: '☰' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">SW</div>
        <div>
          <div className="brand-title">SMART-WHEEL</div>
          <div className="brand-sub">IoT × Machine Learning</div>
        </div>
      </div>
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <span aria-hidden>{l.icon}</span>
          {l.label}
        </NavLink>
      ))}
      <div className="sidebar-foot">
        Dashboard hanya untuk monitoring.
        <br />
        Kontrol keselamatan tetap lokal di ESP32.
      </div>
    </aside>
  );
}
