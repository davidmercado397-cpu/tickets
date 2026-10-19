import { Navigate } from 'react-router-dom';

import { hasPermission, useSessionStore } from '@/shared/session/session.store';

/** Inicio: tablero si puede ver reportes; si no, la bandeja o las visitas. */
export function useHomeRedirect(): JSX.Element | null {
  const user = useSessionStore((s) => s.user);
  if (user?.is_superadmin && !user.tenant) return <Navigate to="/plataforma" replace />;
  if (hasPermission(user, 'reports.view')) return null;
  if (hasPermission(user, ['pqrs.view_all', 'pqrs.view_area', 'pqrs.manage', 'pqrs.respond', 'pqrs.approve'])) {
    return <Navigate to="/pqrs" replace />;
  }
  if (hasPermission(user, ['visits.perform'])) return <Navigate to="/visitas" replace />;
  return <Navigate to="/tareas" replace />;
}
