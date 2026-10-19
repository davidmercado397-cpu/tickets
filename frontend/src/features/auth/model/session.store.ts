import { create } from 'zustand';

import { setToken as bridgeSetToken } from '@/shared/api/auth-bridge';
import type { SessionUser } from '@/shared/api/types';

type Status = 'anonymous' | 'authenticating' | 'authenticated';

const STORAGE_KEY = 'helpdesk.session';

interface Persisted {
  token: string;
  user: SessionUser | null;
}

/** Lee la sesión persistida (localStorage). Tolerante a datos corruptos. */
function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

function persist(token: string | null, user: SessionUser | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* almacenamiento no disponible: la sesión queda solo en memoria */
  }
}

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  status: Status;
  /** Login exitoso: fija token + usuario a la vez. */
  setSession: (token: string, user: SessionUser) => void;
  setToken: (token: string | null) => void;
  setUser: (user: SessionUser) => void;
  clear: () => void;
}

// Restaura la sesión al cargar la app y la sincroniza con el http layer (Bearer).
const initial = loadPersisted();
bridgeSetToken(initial?.token ?? null);

/**
 * Sesión del usuario (estado de cliente). Se persiste en localStorage para sobrevivir
 * a recargas (el JWT del backend dura 8h y no hay refresh). Un 401 (token vencido/inválido)
 * limpia la sesión y redirige a /login. Se refleja en el bridge de `shared/api` para que
 * `http.ts` inyecte el token sin romper la regla de dependencias.
 */
export const useSessionStore = create<SessionState>((set) => ({
  token: initial?.token ?? null,
  user: initial?.user ?? null,
  status: initial?.token ? 'authenticated' : 'anonymous',
  setSession: (token, user) => {
    bridgeSetToken(token);
    persist(token, user);
    set({ token, user, status: 'authenticated' });
  },
  setToken: (token) => {
    bridgeSetToken(token);
    set((s) => {
      persist(token, s.user);
      return { token, status: token ? 'authenticating' : 'anonymous' };
    });
  },
  setUser: (user) =>
    set((s) => {
      persist(s.token, user);
      return { user, status: 'authenticated' };
    }),
  clear: () => {
    bridgeSetToken(null);
    persist(null, null);
    set({ token: null, user: null, status: 'anonymous' });
  },
}));
