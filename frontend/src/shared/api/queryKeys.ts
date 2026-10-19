import type { TicketListParams } from './types';

/** Normaliza params para que la key sea estable (mismo filtro → misma key). */
function normTicketParams(p: TicketListParams): Record<string, unknown> {
  return {
    status: p.status ?? null,
    category: p.category ?? null,
    assignee: p.assignee ?? null,
    openOnly: p.openOnly ?? false,
    from: p.from ?? null,
    to: p.to ?? null,
    page: p.page ?? 1,
    pageSize: p.pageSize ?? 50,
  };
}

export const authKeys = {
  me: ['auth', 'me'] as const,
};

export const ticketKeys = {
  all: ['tickets'] as const,
  lists: () => [...ticketKeys.all, 'list'] as const,
  list: (params: TicketListParams) => [...ticketKeys.lists(), normTicketParams(params)] as const,
  details: () => [...ticketKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
};

export const areaKeys = {
  all: ['areas'] as const,
  list: (onlyActive = false) => [...areaKeys.all, 'list', { onlyActive }] as const,
};

export const categoryKeys = {
  all: ['categories'] as const,
  list: (onlyActive = false) => [...categoryKeys.all, 'list', { onlyActive }] as const,
};

export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unreadOnly = false) => [...notificationKeys.all, 'list', { unreadOnly }] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

export const employeeKeys = {
  all: ['employees'] as const,
  list: (params: { q?: string | null; page?: number }) =>
    [...employeeKeys.all, 'list', { q: params.q ?? null, page: params.page ?? 1 }] as const,
};

export const slaKeys = {
  all: ['sla-policies'] as const,
  list: () => [...slaKeys.all, 'list'] as const,
};
