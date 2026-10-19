import { http, HttpResponse } from 'msw';

import { db, tokenFor, userFromToken } from '@/mocks/db';

export const authHandlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    const user = db.users.find((u) => u.email === body.email);
    if (!user || db.passwords[body.email] !== body.password || !user.active) {
      return HttpResponse.json({ detail: 'Credenciales inválidas.' }, { status: 401 });
    }
    return HttpResponse.json({
      access_token: tokenFor(user.id),
      token_type: 'bearer',
      expires_in: 28800,
    });
  }),

  http.get('*/api/auth/me', ({ request }) => {
    const user = userFromToken(request.headers.get('Authorization'));
    if (!user) return new HttpResponse(null, { status: 401 });
    return HttpResponse.json({
      user_id: user.id,
      email: user.email,
      display_name: user.display_name ?? null,
      role: user.role,
    });
  }),
];
