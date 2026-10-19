import { useTranslation } from 'react-i18next';

import type { HistoryEntry } from '@/shared/api/types';
import { formatRelative } from '@/shared/lib/date';
import { EmptyState } from '@/shared/ui/states/EmptyState';

import { StatusBadge } from './StatusBadge';

export function HistoryTimeline({ history }: { history: HistoryEntry[] }) {
  const { t } = useTranslation('common');
  if (history.length === 0) return <EmptyState title={t('empty')} />;

  return (
    <ol className="space-y-4 border-l pl-4">
      {history.map((h, i) => (
        <li key={i} className="relative space-y-1">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-border" />
          <div className="flex items-center gap-2">
            <StatusBadge status={h.status} />
            <span className="text-xs text-muted-foreground">{formatRelative(h.at)}</span>
            {h.actor && <span className="text-xs text-muted-foreground">· {h.actor}</span>}
          </div>
          {h.note && <p className="text-sm">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}
