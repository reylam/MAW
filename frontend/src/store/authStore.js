import { create } from 'zustand';

/*
  Operator session state.

  The source of truth for *authorization* is the backend
  (POST /api/auth/validate-operator). This store only holds the resulting
  session - authenticated flag, operator email, and the display name the
  operator chose - and mirrors it to localStorage so a refresh keeps the
  operator signed in.

  No credentials or authorized-email lists live here. Protected routes read
  `authenticated` from this store; hiding UI is never used as the access gate.
*/

const STORAGE_KEY = 'maw_session';

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && parsed.name) return parsed;
    return null;
  } catch {
    return null;
  }
}

function persist(session) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable - session stays in memory only */
  }
}

const initial = loadSession();

export const useAuthStore = create((set) => ({
  authenticated: Boolean(initial),
  operator: initial, // { email, name, role, id }

  // Called after the backend confirms the email AND the operator sets a name.
  signIn: (operator) => {
    const session = {
      id: operator.id || null,
      email: operator.email,
      name: operator.name,
      role: operator.role || 'operator',
      signedInAt: new Date().toISOString(),
    };
    persist(session);
    set({ authenticated: true, operator: session });
  },

  signOut: () => {
    persist(null);
    // Clear any legacy auth flag from the previous implementation.
    try { localStorage.removeItem('maw_authenticated'); } catch { /* ignore */ }
    set({ authenticated: false, operator: null });
  },
}));
