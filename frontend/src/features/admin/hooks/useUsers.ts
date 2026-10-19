import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/apiClient';
import { userKeys } from '@/shared/api/queryKeys';
import type { UserCreateInput, UserUpdateInput } from '@/shared/api/types';

export function useUsers() {
  return useQuery({ queryKey: userKeys.list(), queryFn: () => api.listUsers() });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: userKeys.all });

  const create = useMutation({
    mutationFn: (input: UserCreateInput) => api.createUser(input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserUpdateInput }) =>
      api.updateUser(id, input),
    onSuccess: invalidate,
  });

  return { create, update };
}
