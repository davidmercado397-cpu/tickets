import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/apiClient';
import { categoryKeys } from '@/shared/api/queryKeys';
import type { CategoryCreateInput, CategoryUpdateInput } from '@/shared/api/types';

export function useCategoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: categoryKeys.all });

  const create = useMutation({
    mutationFn: (input: CategoryCreateInput) => api.createCategory(input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryUpdateInput }) =>
      api.updateCategory(id, input),
    onSuccess: invalidate,
  });
  const disable = useMutation({
    mutationFn: (id: string) => api.disableCategory(id),
    onSuccess: invalidate,
  });

  return { create, update, disable };
}
