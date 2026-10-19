import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/apiClient';
import { employeeKeys } from '@/shared/api/queryKeys';
import type {
  EmployeeCreateInput,
  EmployeeListParams,
  EmployeeUpdateInput,
} from '@/shared/api/types';

export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: employeeKeys.list({ q: params.q, page: params.page }),
    queryFn: () => api.listEmployees(params),
    placeholderData: keepPreviousData,
  });
}

export function useEmployeeMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: employeeKeys.all });

  const create = useMutation({
    mutationFn: (input: EmployeeCreateInput) => api.createEmployee(input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ document, input }: { document: string; input: EmployeeUpdateInput }) =>
      api.updateEmployee(document, input),
    onSuccess: invalidate,
  });

  return { create, update };
}
