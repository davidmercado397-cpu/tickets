import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUpdateTicket } from '@/features/tickets/hooks/useUpdateTicket';
import type { Priority, TicketDetail, TicketStatus } from '@/shared/api/types';
import { PRIORITIES, TICKET_STATUSES } from '@/shared/api/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

/** Panel de acciones: estado/prioridad (cambio inmediato), responsable y nota. */
export function TicketActions({ ticket }: { ticket: TicketDetail }) {
  const { t } = useTranslation(['tickets', 'common']);
  const update = useUpdateTicket(ticket.id);
  const [assignee, setAssignee] = useState(ticket.assignee ?? '');
  const [note, setNote] = useState('');

  const pending = update.isPending;

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="space-y-1">
        <Label>{t('tickets:changeStatus')}</Label>
        <Select
          value={ticket.status}
          onValueChange={(v) => update.mutate({ status: v as TicketStatus })}
          disabled={pending}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`tickets:statusLabels.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>{t('tickets:changePriority')}</Label>
        <Select
          value={ticket.priority ?? undefined}
          onValueChange={(v) => update.mutate({ priority: v as Priority })}
          disabled={pending}
        >
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`tickets:priorityLabels.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="assignee">{t('tickets:assign')}</Label>
        <div className="flex gap-2">
          <Input
            id="assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="correo@empresa.co"
          />
          <Button
            variant="outline"
            disabled={pending || assignee === (ticket.assignee ?? '')}
            onClick={() => update.mutate({ assignee })}
          >
            {t('common:save')}
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="note">{t('tickets:addNote')}</Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        <Button
          className="w-full"
          disabled={pending || note.trim() === ''}
          onClick={() => update.mutate({ note }, { onSuccess: () => setNote('') })}
        >
          {t('common:save')}
        </Button>
      </div>
    </div>
  );
}
