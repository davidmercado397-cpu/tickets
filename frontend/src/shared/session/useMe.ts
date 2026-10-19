import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { authApi } from '@/shared/api/endpoints';
import { keys } from '@/shared/hooks/queries';
import { applyBrand } from '@/shared/lib/brand';

import { useSessionStore } from './session.store';

/** Revalida el perfil contra /auth/me cuando hay token y aplica la marca de la empresa. */
export function useMe() {
  const token = useSessionStore((s) => s.token);
  const setUser = useSessionStore((s) => s.setUser);
  const user = useSessionStore((s) => s.user);
  const q = useQuery({ queryKey: [...keys.me, token], queryFn: authApi.me, enabled: !!token, staleTime: 60_000 });

  useEffect(() => {
    if (q.data) setUser(q.data);
  }, [q.data, setUser]);

  useEffect(() => {
    applyBrand(user?.tenant?.primary_color, user?.tenant?.secondary_color);
  }, [user?.tenant?.primary_color, user?.tenant?.secondary_color]);

  return q;
}

export function useLogout() {
  const clear = useSessionStore((s) => s.clear);
  const qc = useQueryClient();
  return () => {
    clear();
    qc.clear();
    applyBrand(null, null);
  };
}
