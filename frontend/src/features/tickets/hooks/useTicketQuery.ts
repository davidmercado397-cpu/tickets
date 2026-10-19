import { useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/apiClient';
import { ticketKeys } from '@/shared/api/queryKeys';

export function useTicketQuery(id: string) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => api.getTicket(id),
    enabled: !!id,
  });
}
