import { http, HttpResponse } from 'msw';

import { db, toSummary, userFromToken } from '@/mocks/db';
import type { Schemas } from '@/shared/api/types';

const CLOSED: Schemas['TicketStatus'][] = ['closed', 'rejected'];

export const ticketHandlers = [
  http.get('*/api/tickets', ({ request }) => {
    const user = userFromToken(request.headers.get('Authorization'));
    if (!user) return new HttpResponse(null, { status: 401 });

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const assignee = url.searchParams.get('assignee');
    const openOnly = url.searchParams.get('open_only') === 'true';
    const page = Number(url.searchParams.get('page') ?? '1') || 1;
    const pageSize = Number(url.searchParams.get('page_size') ?? '50') || 50;

    let items = db.tickets;
    // Alcance por área para agentes (el backend lo hace server-side).
    if (user.role === 'agent') items = items.filter((t) => user.area_codes?.includes(t.area));
    if (status) items = items.filter((t) => t.status === status);
    if (category) items = items.filter((t) => t.category === category);
    if (assignee) items = items.filter((t) => (t.assignee ?? '').includes(assignee));
    if (openOnly) items = items.filter((t) => !CLOSED.includes(t.status));

    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize).map(toSummary);

    return HttpResponse.json({ items: paged, total, page, page_size: pageSize });
  }),

  http.get('*/api/tickets/:id', ({ request, params }) => {
    const user = userFromToken(request.headers.get('Authorization'));
    if (!user) return new HttpResponse(null, { status: 401 });
    const ticket = db.tickets.find((t) => t.ticket_id === params.id);
    if (!ticket) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(ticket);
  }),

  http.patch('*/api/tickets/:id', async ({ request, params }) => {
    const user = userFromToken(request.headers.get('Authorization'));
    if (!user) return new HttpResponse(null, { status: 401 });
    const ticket = db.tickets.find((t) => t.ticket_id === params.id);
    if (!ticket) return new HttpResponse(null, { status: 404 });

    const patch = (await request.json()) as Schemas['TicketUpdateIn'];
    const now = '2026-07-03T13:00:00Z';
    if (patch.status && patch.status !== ticket.status) {
      ticket.status = patch.status;
      ticket.history = [
        ...(ticket.history ?? []),
        { at: now, status: patch.status, actor: user.email, note: patch.note ?? null },
      ];
    } else if (patch.note) {
      ticket.history = [
        ...(ticket.history ?? []),
        { at: now, status: ticket.status, actor: user.email, note: patch.note },
      ];
    }
    if (patch.priority !== undefined && patch.priority !== null) ticket.priority = patch.priority;
    if (patch.assignee !== undefined) ticket.assignee = patch.assignee;
    ticket.updated_at = now;

    return HttpResponse.json(ticket);
  }),
];
