import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/apiClient';
import { slaKeys } from '@/shared/api/queryKeys';
import type { Priority, SlaUpsertInput } from '@/shared/api/types';

export function useSlaPolicies() {
  return useQuery({ queryKey: slaKeys.list(), queryFn: () => api.listSlaPolicies() });
}

export function useUpsertSla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ priority, input }: { priority: Priority; input: SlaUpsertInput }) =>
      api.upsertSlaPolicy(priority, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: slaKeys.all }),
  });
}
