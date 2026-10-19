import { Lock, MessageSquare } from 'lucide-react';

import type { PqrsEvent } from '@/shared/api/types';
import { cn } from '@/shared/lib/cn';
import { formatDateTime } from '@/shared/lib/date';
import { EVENT_LABEL, STATUS_LABEL } from '@/shared/lib/labels';

export function Timeline({ events }: { events: PqrsEvent[] }) {
  return (
    <ol className="relative space-y-5 border-l pl-5">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="relative">
          <span
            className={cn(
              'absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-background',
              e.kind === 'requester_message' ? 'bg-warning' : e.internal ? 'bg-muted-foreground' : 'bg-primary',
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-sm font-medium">
              {e.kind === 'status_changed' && e.to_status ? `Estado: ${STATUS_LABEL[e.to_status]}` : EVENT_LABEL[e.kind] ?? e.kind}
            </p>
            {e.internal ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" />
                interno
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                <MessageSquare className="h-3 w-3" />
                visible al solicitante
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(e.at)} · {e.actor_label ?? 'Sistema'}
          </p>
          {e.note && <p className="mt-1 whitespace-pre-line rounded-md bg-muted/50 p-2 text-sm">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
