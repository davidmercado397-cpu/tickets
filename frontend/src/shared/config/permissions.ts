import type { Role, SessionUser } from '@/shared/api/types';

/** Acciones gateadas por rol. El servidor es la fuente de verdad; esto es UX-gating. */
export type Action = 'manageCatalog' | 'manageUsers' | 'updateTicket' | 'viewReports';

const MATRIX: Record<Action, Role[]> = {
  manageCatalog: ['admin'],
  manageUsers: ['admin'],
  updateTicket: ['admin', 'agent'],
  viewReports: ['admin'],
};

export function can(user: SessionUser | null, action: Action): boolean {
  if (!user) return false;
  return MATRIX[action].includes(user.role);
}
