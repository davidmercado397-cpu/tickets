import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSessionStore } from '@/features/auth/model/session.store';

/** Protege rutas privadas: sin token → /login (recordando el destino). */
export function RequireAuth() {
  const token = useSessionStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
