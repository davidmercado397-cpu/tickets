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

describe('Políticas de SLA', () => {
  it('guarda (upsert) la política de una prioridad y la refleja al listar', async () => {
    const saved = await api.upsertSlaPolicy('low', { responseMinutes: 30, resolutionMinutes: 120 });
    expect(saved.priority).toBe('low');
    expect(saved.responseMinutes).toBe(30);

    const list = await api.listSlaPolicies();
    expect(list.find((p) => p.priority === 'low')?.resolutionMinutes).toBe(120);
  });
});
