import { useEffect, type ReactNode } from 'react';

import { registerUnauthorizedHandler } from '@/shared/api/auth-bridge';
import { useSessionStore } from '@/shared/session/session.store';
import { useMe } from '@/shared/session/useMe';

/** 401 → limpia la sesión (los guards redirigen). Revalida el perfil y aplica la marca. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const clear = useSessionStore((s) => s.clear);
  useEffect(() => {
    registerUnauthorizedHandler(() => clear());
    return () => registerUnauthorizedHandler(null);
  }, [clear]);
  useMe();
  return <>{children}</>;
}
