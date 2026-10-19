import { useState, useRef, useEffect } from 'react';
import { useMawStore } from '../../store/mawStore';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, ChevronDown } from 'lucide-react';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TopBar({ title }) {
  const { isDarkMode, toggleDarkMode } = useMawStore();
  const operator = useAuthStore((s) => s.operator);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    signOut();
    navigate('/', { replace: true });
  };

  const initial = (operator?.name || 'O').trim().charAt(0).toUpperCase();

  return (
    <header className="h-14 sm:h-16 bg-maw-surface border-b border-maw-border flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="min-w-0">
        <div className="hidden sm:block eyebrow">MAW · Control room</div>
        <h1 className="text-sm sm:text-[15px] font-display font-semibold text-maw-text-main tracking-tight truncate">
          {operator ? `${greeting()}, ${operator.name}` : title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2 pr-1 border-r border-maw-border-subtle mr-1">
          <span className="status-dot bg-maw-safe" />
          <span className="text-[11px] font-mono font-medium text-maw-text-muted uppercase tracking-wide">
            System Online
          </span>
        </div>

        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-maw-sm text-maw-text-muted hover:bg-maw-hover hover:text-maw-text-main transition-colors"
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-maw-sm hover:bg-maw-hover transition-colors"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex items-center justify-center h-7 w-7 rounded-full bg-maw-primary text-white text-xs font-semibold">
              {initial}
            </span>
            <span className="hidden sm:block text-sm font-medium text-maw-text-main max-w-[8rem] truncate">
              {operator?.name || 'Operator'}
            </span>
            <ChevronDown size={14} className="text-maw-text-subtle" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 bg-maw-surface border border-maw-border rounded-maw shadow-maw z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-maw-border-subtle">
                <div className="text-[10px] uppercase tracking-wide text-maw-text-subtle font-mono">Operator</div>
                <div className="text-sm font-semibold text-maw-text-main truncate">{operator?.name}</div>
                <div className="text-xs text-maw-text-subtle truncate font-mono">{operator?.email}</div>
              </div>
              <button
                onClick={handleLogout}
                role="menuitem"
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-maw-text-muted hover:bg-maw-critical-soft hover:text-maw-critical transition-colors"
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
