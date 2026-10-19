import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/apiClient';
import { ticketKeys } from '@/shared/api/queryKeys';
import type { TicketListParams } from '@/shared/api/types';

/** Listado de tickets con paginación fluida (conserva datos al cambiar de página). */
export function useTicketsQuery(params: TicketListParams) {
  return useQuery({
    queryKey: ticketKeys.list(params),
    queryFn: () => api.listTickets(params),
    placeholderData: keepPreviousData,
  });
}
