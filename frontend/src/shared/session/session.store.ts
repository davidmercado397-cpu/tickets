import { create } from 'zustand';

import { setToken as bridgeSetToken } from '@/shared/api/auth-bridge';
import type { Me } from '@/shared/api/types';

type Status = 'anonymous' | 'authenticating' | 'authenticated';

const STORAGE_KEY = 'pqrs.session';

interface Persisted {
  token: string;
  user: Me | null;
}

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

function persist(token: string | null, user: Me | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* almacenamiento no disponible: la sesión queda solo en memoria */
  }
}

interface SessionState {
  token: string | null;
  user: Me | null;
  status: Status;
  setToken: (token: string) => void;
  setUser: (user: Me) => void;
  clear: () => void;
}

const initial = loadPersisted();
bridgeSetToken(initial?.token ?? null);

/**
 * Sesión (token + perfil con permisos efectivos). Persistida para sobrevivir recargas; un 401
 * la limpia. Vive en `shared` porque todas las features consultan permisos.
 */
export const useSessionStore = create<SessionState>((set) => ({
  token: initial?.token ?? null,
  user: initial?.user ?? null,
  status: initial?.token ? (initial.user ? 'authenticated' : 'authenticating') : 'anonymous',
  setToken: (token) => {
    bridgeSetToken(token);
    persist(token, null);
    set({ token, user: null, status: 'authenticating' });
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

export const useSessionUser = () => useSessionStore((s) => s.user);

/** `can("pqrs.approve")` o `can(["pqrs.view_all", "pqrs.view_area"])` (cualquiera). */
export function hasPermission(user: Me | null, perm: string | string[]): boolean {
  if (!user) return false;
  if (user.is_superadmin) return true;
  const list = Array.isArray(perm) ? perm : [perm];
  return list.length === 0 || list.some((p) => user.permissions.includes(p));
}

export function useCan(): (perm: string | string[]) => boolean {
  const user = useSessionUser();
  return (perm) => hasPermission(user, perm);
}
