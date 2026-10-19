import { useSessionStore } from '@/features/auth/model/session.store';

/** Selectores de sesión para la UI (evitan suscribirse a todo el store). */
export const useSessionUser = () => useSessionStore((s) => s.user);
export const useIsAuthenticated = () => useSessionStore((s) => !!s.token);

export function useLogout() {
  return useSessionStore((s) => s.clear);
}
