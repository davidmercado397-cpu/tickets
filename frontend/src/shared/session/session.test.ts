import type { Me } from '@/shared/api/types';

import { hasPermission } from './session.store';

const base: Me = {
  id: '1', email: 'a@b.co', full_name: 'A', phone: null, position: null, is_superadmin: false, has_signature: false,
  tenant: null, roles: [], areas: [], permissions: ['pqrs.view_area', 'tasks.manage'],
};

describe('permisos en el frontend', () => {
  it('exige al menos uno de los permisos', () => {
    expect(hasPermission(base, 'pqrs.view_area')).toBe(true);
    expect(hasPermission(base, ['pqrs.approve', 'tasks.manage'])).toBe(true);
    expect(hasPermission(base, 'pqrs.approve')).toBe(false);
    expect(hasPermission(null, 'pqrs.view_area')).toBe(false);
  });

  it('el superadmin puede todo', () => {
    expect(hasPermission({ ...base, is_superadmin: true, permissions: [] }, 'roles.manage')).toBe(true);
  });
});
