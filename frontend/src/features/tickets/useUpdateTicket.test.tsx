import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@/features/auth/model/session.store';
import { useUpdateTicket } from '@/features/tickets/hooks/useUpdateTicket';
import { server } from '@/mocks/server';
import { api } from '@/shared/api/apiClient';
import { ticketKeys } from '@/shared/api/queryKeys';
import type { TicketDetail } from '@/shared/api/types';
import i18n from '@/shared/i18n/config';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  useSessionStore.getState().setSession('mock-token-u1', {
    userId: 'u1',
    email: 'admin@demo.co',
    displayName: 'Admin',
    role: 'admin',
  });
});

async function primeDetail(qc: QueryClient): Promise<TicketDetail> {
  const detail = await api.getTicket('t1');
  qc.setQueryData(ticketKeys.detail('t1'), detail);
  return detail;
}

describe('Actualización de ticket', () => {
  it('actualiza el estado de forma optimista y confirma con el servidor', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    await primeDetail(qc);

    const { result } = renderHook(() => useUpdateTicket('t1'), { wrapper: makeWrapper(qc) });
    act(() => result.current.mutate({ status: 'closed' }));

    // El cache refleja el nuevo estado (optimista → confirmado por el servidor).
    await waitFor(() =>
      expect(qc.getQueryData<TicketDetail>(ticketKeys.detail('t1'))?.status).toBe('closed'),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('revierte al estado previo si el PATCH falla', async () => {
    server.use(http.patch('*/api/tickets/:id', () => new HttpResponse(null, { status: 500 })));
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    await primeDetail(qc);

    const { result } = renderHook(() => useUpdateTicket('t1'), { wrapper: makeWrapper(qc) });
    act(() => result.current.mutate({ status: 'closed' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    // Rollback: vuelve a 'open' (el estado sembrado).
    expect(qc.getQueryData<TicketDetail>(ticketKeys.detail('t1'))?.status).toBe('open');
  });
});
