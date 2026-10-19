import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { hasPermission, useSessionStore } from '@/shared/session/session.store';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { LoadingState } from '@/shared/ui/states/LoadingState';

export function RequireAuth() {
  const { token, user, status } = useSessionStore();
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (status === 'authenticating' && !user) {
    return (
      <div className="p-8">
        <LoadingState rows={4} />
      </div>
    );
  }
  return <Outlet />;
}

/** Exige al menos uno de los permisos. */
export function RequirePerm({ perms, superadmin }: { perms?: string[]; superadmin?: boolean }) {
  const user = useSessionStore((s) => s.user);
  const ok = superadmin ? !!user?.is_superadmin : hasPermission(user, perms ?? []);
  if (!ok) {
    return <EmptyState title="Sin acceso" description="Tu rol no tiene permiso para esta sección." />;
  }
  return <Outlet />;
}
