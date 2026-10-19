import type { Priority, TicketStatus } from '@/shared/api/types';
import type { BadgeProps } from '@/shared/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

/**
 * Registro (Strategy) de presentación por estado/prioridad: variante de badge + clave
 * i18n de la label. Añadir un estado = una entrada; sin tocar los componentes (OCP).
 */
export const STATUS_REGISTRY: Record<TicketStatus, { badge: BadgeVariant; labelKey: string }> = {
  open: { badge: 'secondary', labelKey: 'tickets:statusLabels.open' },
  in_review: { badge: 'warning', labelKey: 'tickets:statusLabels.in_review' },
  assigned: { badge: 'default', labelKey: 'tickets:statusLabels.assigned' },
  in_progress: { badge: 'default', labelKey: 'tickets:statusLabels.in_progress' },
  on_hold: { badge: 'warning', labelKey: 'tickets:statusLabels.on_hold' },
  closed: { badge: 'success', labelKey: 'tickets:statusLabels.closed' },
  rejected: { badge: 'destructive', labelKey: 'tickets:statusLabels.rejected' },
};

export const PRIORITY_REGISTRY: Record<Priority, { badge: BadgeVariant; labelKey: string }> = {
  low: { badge: 'secondary', labelKey: 'tickets:priorityLabels.low' },
  medium: { badge: 'default', labelKey: 'tickets:priorityLabels.medium' },
  high: { badge: 'warning', labelKey: 'tickets:priorityLabels.high' },
  critical: { badge: 'destructive', labelKey: 'tickets:priorityLabels.critical' },
};
