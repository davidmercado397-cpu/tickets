import { http, HttpResponse } from 'msw';

import { db, userFromToken } from '@/mocks/db';
import type { Schemas } from '@/shared/api/types';
import { slugify } from '@/shared/lib/slugify';

let seq = 100;
const nid = (p: string) => `${p}${(seq += 1)}`;

function isAdmin(request: Request): boolean {
  return userFromToken(request.headers.get('Authorization'))?.role === 'admin';
}
function isAuthed(request: Request): boolean {
  return userFromToken(request.headers.get('Authorization')) !== null;
}

export const catalogHandlers = [
  // --- áreas ---
  http.get('*/api/areas', ({ request }) => {
    if (!isAuthed(request)) return new HttpResponse(null, { status: 401 });
    const onlyActive = new URL(request.url).searchParams.get('only_active') === 'true';
    return HttpResponse.json(onlyActive ? db.areas.filter((a) => a.active) : db.areas);
  }),
  http.post('*/api/areas', async ({ request }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const body = (await request.json()) as Schemas['AreaCreateIn'];
    const area: Schemas['AreaOut'] = {
      id: nid('a'),
      code: body.code || slugify(body.name),
      name: body.name,
      active: true,
    };
    db.areas.push(area);
    return HttpResponse.json(area, { status: 201 });
  }),
  http.patch('*/api/areas/:id', async ({ request, params }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const area = db.areas.find((a) => a.id === params.id);
    if (!area) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as Schemas['AreaUpdateIn'];
    if (body.name != null) area.name = body.name;
    if (body.active != null) area.active = body.active;
    return HttpResponse.json(area);
  }),
  http.delete('*/api/areas/:id', ({ request, params }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const area = db.areas.find((a) => a.id === params.id);
    if (!area) return new HttpResponse(null, { status: 404 });
    area.active = false;
    return HttpResponse.json(area);
  }),

  // --- categorías ---
  http.get('*/api/categories', ({ request }) => {
    if (!isAuthed(request)) return new HttpResponse(null, { status: 401 });
    const onlyActive = new URL(request.url).searchParams.get('only_active') === 'true';
    return HttpResponse.json(onlyActive ? db.categories.filter((c) => c.active) : db.categories);
  }),
  http.post('*/api/categories', async ({ request }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const body = (await request.json()) as Schemas['CategoryCreateIn'];
    const cat: Schemas['CategoryOut'] = {
      id: nid('c'),
      code: body.code || slugify(body.name),
      name: body.name,
      area: body.area,
      active: true,
    };
    db.categories.push(cat);
    return HttpResponse.json(cat, { status: 201 });
  }),
  http.patch('*/api/categories/:id', async ({ request, params }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const cat = db.categories.find((c) => c.id === params.id);
    if (!cat) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as Schemas['CategoryUpdateIn'];
    if (body.name != null) cat.name = body.name;
    if (body.active != null) cat.active = body.active;
    return HttpResponse.json(cat);
  }),
  http.delete('*/api/categories/:id', ({ request, params }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const cat = db.categories.find((c) => c.id === params.id);
    if (!cat) return new HttpResponse(null, { status: 404 });
    cat.active = false;
    return HttpResponse.json(cat);
  }),
];
