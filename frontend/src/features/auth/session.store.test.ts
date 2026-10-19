import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@/features/auth/model/session.store';

const KEY = 'helpdesk.session';
const user = { userId: 'u1', email: 'a@b.co', displayName: null, role: 'admin' as const };

beforeEach(() => useSessionStore.getState().clear());

describe('Sesión persistente', () => {
  it('guarda la sesión en localStorage al iniciar sesión (sobrevive a recargas)', () => {
    useSessionStore.getState().setSession('tok-1', user);
    const raw = localStorage.getItem(KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).token).toBe('tok-1');
    expect(JSON.parse(raw as string).user.email).toBe('a@b.co');
  });

  it('borra la sesión de localStorage al cerrar sesión', () => {
    useSessionStore.getState().setSession('tok-1', user);
    useSessionStore.getState().clear();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
