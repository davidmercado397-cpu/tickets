import { Navigate, Outlet } from 'react-router-dom';

import { useSessionStore } from '@/features/auth/model/session.store';
import type { Role } from '@/shared/api/types';

/** Restringe por rol (asume RequireAuth arriba). Rol no permitido → /tickets. */
export function RequireRole({ allow }: { allow: Role[] }) {
  const user = useSessionStore((s) => s.user);

  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/tickets" replace />;
  return <Outlet />;
}
