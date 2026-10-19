import { http, HttpResponse } from 'msw';

import { db, userFromToken } from '@/mocks/db';
import type { Schemas } from '@/shared/api/types';

export const slaHandlers = [
  http.get('*/api/sla-policies', ({ request }) => {
    if (!userFromToken(request.headers.get('Authorization')))
      return new HttpResponse(null, { status: 401 });
    return HttpResponse.json(db.slaPolicies);
  }),

  http.put('*/api/sla-policies/:priority', async ({ request, params }) => {
    if (userFromToken(request.headers.get('Authorization'))?.role !== 'admin')
      return new HttpResponse(null, { status: 403 });
    const priority = params.priority as Schemas['Priority'];
    const body = (await request.json()) as Schemas['SlaPolicyUpsertIn'];
    const existing = db.slaPolicies.find((p) => p.priority === priority);
    const policy: Schemas['SlaPolicyOut'] = {
      priority,
      response_minutes: body.response_minutes,
      resolution_minutes: body.resolution_minutes,
    };
    if (existing) Object.assign(existing, policy);
    else db.slaPolicies.push(policy);
    return HttpResponse.json(policy);
  }),
];
