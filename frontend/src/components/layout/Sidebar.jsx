import { Home, Map, Radio, AlertTriangle, Clock, Network, Activity, Settings, Play, LogOut } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useAuthStore } from '../../store/authStore';

export default function Sidebar() {
  const navigate = useNavigate();
  const operator = useAuthStore((s) => s.operator);
  const signOut = useAuthStore((s) => s.signOut);

  const handleLogout = () => {
    signOut();
    navigate('/', { replace: true });
  };

  const links = [
    { to: '/dashboard', icon: Home, label: 'Dashboard', group: 'main' },
    { to: '/map', icon: Map, label: 'Live Map', group: 'main' },
    { to: '/crossings', icon: Radio, label: 'Crossings', group: 'main' },
    { to: '/alerts', icon: AlertTriangle, label: 'Alerts', group: 'main' },
    { to: '/events', icon: Clock, label: 'Event History', group: 'main' },
    { to: '/network', icon: Network, label: 'Network', group: 'system' },
    { to: '/health', icon: Activity, label: 'Device Health', group: 'system' },
    { to: '/simulation', icon: Play, label: 'Simulation', group: 'system' },
    { to: '/settings', icon: Settings, label: 'Settings', group: 'system' },
  ];

  const mainLinks = links.filter((l) => l.group === 'main');
  const systemLinks = links.filter((l) => l.group === 'system');

  const linkClass = ({ isActive }) =>
    `group relative flex items-center gap-3 px-3 py-2 rounded-maw-sm text-sm font-medium transition-colors ${
      isActive
        ? 'bg-maw-primary-soft text-maw-primary'
        : 'text-maw-text-muted hover:bg-maw-hover hover:text-maw-text-main'
    }`;

  const renderGroup = (label, items) => (
    <div>
      <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-maw-text-subtle">{label}</div>
      <div className="space-y-0.5">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={linkClass}>
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-maw-primary transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <Icon size={17} strokeWidth={isActive ? 2.25 : 1.9} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );

  const mobileLinks = links.slice(0, 4);
  const initial = (operator?.name || 'O').trim().charAt(0).toUpperCase();

  return (
    <>
      <aside className="hidden lg:flex w-60 bg-maw-surface border-r border-maw-border flex-col h-screen">
        <div className="px-5 py-4 border-b border-maw-border-subtle">
          <img src={logo} alt="MAW" className="w-24 h-auto object-contain object-left" />
          <div className="mt-1.5 eyebrow">Smart Rail Guard</div>
        </div>

        <nav className="flex-1 px-2.5 py-5 space-y-6 overflow-y-auto">
          {renderGroup('Operations', mainLinks)}
          {renderGroup('System', systemLinks)}
        </nav>

        {/* Operator profile + logout */}
        <div className="p-3 border-t border-maw-border-subtle space-y-2">
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-maw-hover rounded-maw-sm border border-maw-border-subtle">
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-maw-primary text-white text-sm font-semibold shrink-0">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wide text-maw-text-subtle font-mono">Operator</div>
              <div className="text-sm font-semibold text-maw-text-main truncate">{operator?.name || 'Operator'}</div>
              <div className="text-[10px] text-maw-text-subtle truncate font-mono">{operator?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-maw-sm text-sm font-medium text-maw-text-muted border border-maw-border-subtle hover:bg-maw-critical-soft hover:text-maw-critical hover:border-maw-critical-border transition-colors"
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-maw-surface border-t border-maw-border grid grid-cols-4 h-16 pb-[env(safe-area-inset-bottom)]">
        {mobileLinks.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                isActive ? 'text-maw-primary' : 'text-maw-text-subtle'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                <span>{label === 'Live Map' ? 'Map' : label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
