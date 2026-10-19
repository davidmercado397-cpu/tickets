import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@/features/auth/model/session.store';
import { api } from '@/shared/api/apiClient';


beforeEach(() =>
  useSessionStore.getState().setSession('mock-token-u1', {
    userId: 'u1',
    email: 'admin@demo.co',
    displayName: 'Admin',
    role: 'admin',
  }),
);

describe('Empleados', () => {
  it('lista empleados paginados', async () => {
    const page = await api.listEmployees({ page: 1, pageSize: 20 });
    expect(page.total).toBeGreaterThanOrEqual(2);
    expect(page.items[0]?.document).toBeTruthy();
  });

  it('filtra por búsqueda (q)', async () => {
    const page = await api.listEmployees({ q: 'María', page: 1, pageSize: 20 });
    expect(page.items.length).toBeGreaterThanOrEqual(1);
    expect(page.items.every((e) => e.fullName.includes('María'))).toBe(true);
  });

  it('crea un empleado nuevo', async () => {
    const created = await api.createEmployee({ document: '9001', fullName: 'Nuevo Empleado' });
    expect(created.document).toBe('9001');
  });
});
