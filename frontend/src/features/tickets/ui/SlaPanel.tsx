import { useTranslation } from 'react-i18next';

import type { Sla } from '@/shared/api/types';
import { formatDateTime, formatRelative } from '@/shared/lib/date';
import { Badge } from '@/shared/ui/badge';
import { Progress } from '@/shared/ui/progress';

function elapsedPct(start: Date, due: Date): number {
  const total = due.getTime() - start.getTime();
  if (total <= 0) return 100;
  const now = new Date().getTime();
  return Math.min(100, Math.max(0, ((now - start.getTime()) / total) * 100));
}

function SlaRow({
  label,
  start,
  dueAt,
  metAt,
  breached,
}: {
  label: string;
  start: Date;
  dueAt: Date | null;
  metAt: Date | null;
  breached: boolean;
}) {
  const { t } = useTranslation('tickets');
  if (!dueAt) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">—</span>
        </div>
      </div>
    );
  }

  const met = !!metAt;
  const value = met ? 100 : elapsedPct(start, dueAt);
  const indicator = breached
    ? 'bg-destructive'
    : met
      ? 'bg-success'
      : value > 80
        ? 'bg-warning'
        : 'bg-primary';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        {breached ? (
          <Badge variant="destructive">{t('slaBreached')}</Badge>
        ) : met ? (
          <span className="text-success">✓ {formatDateTime(metAt)}</span>
        ) : (
          <span className="text-muted-foreground">{formatRelative(dueAt)}</span>
        )}
      </div>
      <Progress value={value} indicatorClassName={indicator} />
      <p className="text-xs text-muted-foreground">{formatDateTime(dueAt)}</p>
    </div>
  );
}

export function SlaPanel({ sla, createdAt }: { sla: Sla; createdAt: Date }) {
  const { t } = useTranslation('tickets');
  return (
    <div className="space-y-5 rounded-lg border p-4">
      <SlaRow
        label={t('slaResponse')}
        start={createdAt}
        dueAt={sla.responseDueAt}
        metAt={sla.firstResponseAt}
        breached={sla.responseBreached}
      />
      <SlaRow
        label={t('slaResolution')}
        start={createdAt}
        dueAt={sla.resolutionDueAt}
        metAt={sla.resolvedAt}
        breached={sla.resolutionBreached}
      />
    </div>
  );
}
