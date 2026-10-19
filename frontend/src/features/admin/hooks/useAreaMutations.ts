import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/apiClient';
import { areaKeys } from '@/shared/api/queryKeys';
import type { AreaCreateInput, AreaUpdateInput } from '@/shared/api/types';

export function useAreaMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: areaKeys.all });

  const create = useMutation({
    mutationFn: (input: AreaCreateInput) => api.createArea(input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AreaUpdateInput }) =>
      api.updateArea(id, input),
    onSuccess: invalidate,
  });
  const disable = useMutation({
    mutationFn: (id: string) => api.disableArea(id),
    onSuccess: invalidate,
  });

  return { create, update, disable };
}
