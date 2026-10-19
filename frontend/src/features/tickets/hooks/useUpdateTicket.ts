import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api } from '@/shared/api/apiClient';
import { ticketKeys } from '@/shared/api/queryKeys';
import type { TicketDetail, TicketUpdateInput } from '@/shared/api/types';
import { toast } from '@/shared/ui/sonner';

/** Aplica optimistamente solo lo mostrable ya (estado/prioridad/responsable). */
function applyPatch(prev: TicketDetail, patch: TicketUpdateInput): TicketDetail {
  return {
    ...prev,
    status: patch.status ?? prev.status,
    priority: patch.priority ?? prev.priority,
    assignee: patch.assignee ?? prev.assignee,
  };
}

/**
 * PATCH de ticket con update optimista + rollback + toast. history/sla vienen
 * recalculados del servidor → se refrescan en onSettled (fuente de verdad).
 */
export function useUpdateTicket(id: string) {
  const qc = useQueryClient();
  const { t } = useTranslation('tickets');

  return useMutation({
    mutationFn: (patch: TicketUpdateInput) => api.updateTicket(id, patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ticketKeys.detail(id) });
      const prev = qc.getQueryData<TicketDetail>(ticketKeys.detail(id));
      if (prev) {
        qc.setQueryData<TicketDetail>(ticketKeys.detail(id), applyPatch(prev, patch));
      }
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(ticketKeys.detail(id), ctx.prev);
      toast.error(t('updateError'));
    },
    onSuccess: () => toast.success(t('updateOk')),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
  });
}
