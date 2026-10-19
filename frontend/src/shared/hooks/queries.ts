/** Consultas compartidas entre features (catálogos, usuarios, clientes...). */
import { useQuery } from '@tanstack/react-query';

import { catalogApi, clientsApi, identityApi } from '@/shared/api/endpoints';
import type { Segment } from '@/shared/api/types';

export const keys = {
  me: ['me'] as const,
  areas: ['areas'] as const,
  roles: ['roles'] as const,
  permissions: ['permissions'] as const,
  users: (q?: string) => ['users', q ?? ''] as const,
  lookup: (perm: string, area?: string | null) => ['users-lookup', perm, area ?? ''] as const,
  types: ['request-types'] as const,
  categories: (segment?: Segment) => ['categories', segment ?? 'all'] as const,
  clients: (q?: string) => ['clients', q ?? ''] as const,
  client: (id: string) => ['client', id] as const,
  sites: (clientId?: string) => ['sites', clientId ?? 'all'] as const,
  pqrs: ['pqrs'] as const,
  tasks: ['tasks'] as const,
  visits: ['visits'] as const,
  notifications: ['notifications'] as const,
  tenant: ['tenant'] as const,
};

const STATIC = { staleTime: 5 * 60_000 };

export const useAreas = () => useQuery({ queryKey: keys.areas, queryFn: identityApi.areas, ...STATIC });
export const useRoles = () => useQuery({ queryKey: keys.roles, queryFn: identityApi.roles, ...STATIC });
export const usePermissions = () =>
  useQuery({ queryKey: keys.permissions, queryFn: identityApi.permissions, staleTime: Infinity });
export const useRequestTypes = () => useQuery({ queryKey: keys.types, queryFn: catalogApi.types, ...STATIC });
export const useCategories = (segment?: Segment) =>
  useQuery({ queryKey: keys.categories(segment), queryFn: () => catalogApi.categories(segment), ...STATIC });
export const useClients = (q?: string, enabled = true) =>
  useQuery({ queryKey: keys.clients(q), queryFn: () => clientsApi.list(q), enabled, staleTime: 60_000 });
export const useSites = (clientId?: string, enabled = true) =>
  useQuery({ queryKey: keys.sites(clientId), queryFn: () => clientsApi.sites(clientId), enabled, staleTime: 60_000 });
export const useUserLookup = (permission: string, areaId?: string | null, enabled = true) =>
  useQuery({
    queryKey: keys.lookup(permission, areaId),
    queryFn: () => identityApi.lookup(permission, areaId),
    enabled,
    staleTime: 60_000,
  });
