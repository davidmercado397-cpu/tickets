import { useTranslation } from 'react-i18next';

import { PRIORITY_REGISTRY, STATUS_REGISTRY } from '@/features/tickets/model/status.registry';
import type { Priority, TicketStatus } from '@/shared/api/types';
import { Badge } from '@/shared/ui/badge';

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useTranslation('tickets');
  const cfg = STATUS_REGISTRY[status];
  return <Badge variant={cfg.badge}>{t(cfg.labelKey)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  const { t } = useTranslation('tickets');
  if (!priority) return <span className="text-muted-foreground">—</span>;
  const cfg = PRIORITY_REGISTRY[priority];
  return <Badge variant={cfg.badge}>{t(cfg.labelKey)}</Badge>;
}
