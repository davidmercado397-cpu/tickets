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

describe('Notificaciones', () => {
  it('devuelve el conteo de no leídas como número (parsea el objeto)', async () => {
    const count = await api.unreadCount();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('marca todas como leídas y el conteo baja a 0', async () => {
    await api.markAllNotificationsRead();
    expect(await api.unreadCount()).toBe(0);
  });
});
