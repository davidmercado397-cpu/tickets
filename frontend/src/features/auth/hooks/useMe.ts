import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSessionStore } from '@/features/auth/model/session.store';
import { api } from '@/shared/api/apiClient';
import { authKeys } from '@/shared/api/queryKeys';

/** Rehidrata el usuario desde /me cuando hay token pero no usuario cargado. */
export function useMe() {
  const token = useSessionStore((s) => s.token);
  const setUser = useSessionStore((s) => s.setUser);

  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: () => api.me(),
    enabled: !!token,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  return query;
}
