import { http, HttpResponse } from 'msw';

import { db, userFromToken } from '@/mocks/db';
import type { Schemas } from '@/shared/api/types';

let seq = 200;
const nid = () => `u${(seq += 1)}`;

function isAdmin(request: Request): boolean {
  return userFromToken(request.headers.get('Authorization'))?.role === 'admin';
}

export const userHandlers = [
  http.get('*/api/users', ({ request }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    return HttpResponse.json(db.users);
  }),
  http.post('*/api/users', async ({ request }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const body = (await request.json()) as Schemas['UserCreateIn'];
    const user: Schemas['UserOut'] = {
      id: nid(),
      email: body.email,
      display_name: body.display_name ?? null,
      phone: body.phone ?? null,
      role: body.role,
      active: true,
      area_codes: body.area_codes ?? [],
    };
    db.users.push(user);
    db.passwords[body.email] = body.password;
    return HttpResponse.json(user, { status: 201 });
  }),
  http.patch('*/api/users/:id', async ({ request, params }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const user = db.users.find((u) => u.id === params.id);
    if (!user) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as Schemas['UserUpdateIn'];
    if (body.display_name !== undefined) user.display_name = body.display_name;
    if (body.phone !== undefined) user.phone = body.phone;
    if (body.role != null) user.role = body.role;
    if (body.active != null) user.active = body.active;
    if (body.area_codes != null) user.area_codes = body.area_codes;
    if (body.password) db.passwords[user.email] = body.password;
    return HttpResponse.json(user);
  }),
];
