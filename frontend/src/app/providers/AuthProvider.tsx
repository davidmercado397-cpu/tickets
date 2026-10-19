import { useEffect, type ReactNode } from 'react';

import { useMe } from '@/features/auth/hooks/useMe';
import { useSessionStore } from '@/features/auth/model/session.store';
import { registerUnauthorizedHandler } from '@/shared/api/auth-bridge';

/**
 * - Registra el handler de 401: al recibirlo, limpia la sesión. No navega
 *   imperativamente — los guards (RequireAuth) reaccionan al token nulo y redirigen.
 * - Revalida la sesión restaurada de localStorage contra /me (useMe): si el token
 *   venció, /me responde 401 → se limpia; si es válido, refresca el usuario.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const clear = useSessionStore((s) => s.clear);

  useEffect(() => {
    registerUnauthorizedHandler(() => clear());
    return () => registerUnauthorizedHandler(null);
  }, [clear]);

  useMe();

  return <>{children}</>;
}
