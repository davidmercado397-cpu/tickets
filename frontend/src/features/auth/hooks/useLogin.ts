import { useMutation } from '@tanstack/react-query';

import { useSessionStore } from '@/features/auth/model/session.store';
import { api } from '@/shared/api/apiClient';
import type { LoginInput } from '@/shared/api/types';

/**
 * Login: intercambia credenciales por token, fija el token (para que /me lleve el
 * Bearer), pide /me y persiste la sesión. Errores 401 → "Credenciales inválidas".
 */
export function useLogin() {
  const setToken = useSessionStore((s) => s.setToken);
  const setSession = useSessionStore((s) => s.setSession);
  const clear = useSessionStore((s) => s.clear);

  return useMutation({
    mutationFn: async (values: LoginInput) => {
      const { accessToken } = await api.login(values);
      setToken(accessToken);
      const user = await api.me();
      return { accessToken, user };
    },
    onSuccess: ({ accessToken, user }) => setSession(accessToken, user),
    onError: () => clear(),
  });
}
