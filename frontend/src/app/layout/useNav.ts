import { NAV_SECTIONS, type NavSection } from '@/app/layout/nav';
import { hasPermission, useSessionUser } from '@/shared/session/session.store';

/** Secciones de navegación visibles para el usuario según sus permisos. */
export function useNavSections(): NavSection[] {
  const user = useSessionUser();
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => {
      if (i.superadmin) return !!user?.is_superadmin;
      if (user?.is_superadmin && !user.tenant) return false; // el superadmin sin empresa solo ve Plataforma
      return hasPermission(user, i.perms);
    }),
  })).filter((s) => s.items.length > 0);
}
