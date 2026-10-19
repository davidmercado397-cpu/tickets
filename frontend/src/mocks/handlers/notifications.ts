import { http, HttpResponse } from 'msw';

import { db, userFromToken } from '@/mocks/db';

function authed(request: Request): boolean {
  return userFromToken(request.headers.get('Authorization')) !== null;
}

export const notificationHandlers = [
  http.get('*/api/notifications', ({ request }) => {
    if (!authed(request)) return new HttpResponse(null, { status: 401 });
    const unreadOnly = new URL(request.url).searchParams.get('unread_only') === 'true';
    const items = unreadOnly ? db.notifications.filter((n) => !n.read) : db.notifications;
    return HttpResponse.json(items);
  }),

  http.get('*/api/notifications/unread-count', ({ request }) => {
    if (!authed(request)) return new HttpResponse(null, { status: 401 });
    return HttpResponse.json({ count: db.notifications.filter((n) => !n.read).length });
  }),

  http.post('*/api/notifications/read-all', ({ request }) => {
    if (!authed(request)) return new HttpResponse(null, { status: 401 });
    let updated = 0;
    for (const n of db.notifications)
      if (!n.read) {
        n.read = true;
        updated += 1;
      }
    return HttpResponse.json({ updated });
  }),

  http.post('*/api/notifications/:id/read', ({ request, params }) => {
    if (!authed(request)) return new HttpResponse(null, { status: 401 });
    const n = db.notifications.find((x) => x.id === params.id);
    if (n) n.read = true;
    return HttpResponse.json({ ok: true });
  }),
  // /notifications/stream (SSE) no se mockea: el provider solo abre el stream en modo real.
];
