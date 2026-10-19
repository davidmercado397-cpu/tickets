import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@/features/auth/model/session.store';
import { TicketsListPage } from '@/features/tickets/ui/TicketsListPage';
import { renderWithProviders } from '@/test/renderWithProviders';

beforeEach(() => {
  useSessionStore.getState().setSession('mock-token-u1', {
    userId: 'u1',
    email: 'admin@demo.co',
    displayName: 'Admin',
    role: 'admin',
  });
});

describe('Listado de tickets', () => {
  it('renderiza las filas del listado', async () => {
    renderWithProviders(<TicketsListPage />, { route: '/tickets' });

    expect(await screen.findByText('SRV-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('SRV-2026-000002')).toBeInTheDocument();
  });

  it('filtra por estado desde la URL (open) y omite los demás', async () => {
    renderWithProviders(<TicketsListPage />, { route: '/tickets?status=open' });

    expect(await screen.findByText('SRV-2026-000001')).toBeInTheDocument();
    expect(screen.queryByText('SRV-2026-000002')).not.toBeInTheDocument();
  });
});
