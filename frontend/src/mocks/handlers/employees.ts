import { http, HttpResponse } from 'msw';

import { db, userFromToken } from '@/mocks/db';
import type { Schemas } from '@/shared/api/types';

function isAdmin(request: Request): boolean {
  return userFromToken(request.headers.get('Authorization'))?.role === 'admin';
}

export const employeeHandlers = [
  http.get('*/api/employees', ({ request }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const page = Number(url.searchParams.get('page') ?? '1') || 1;
    const pageSize = Number(url.searchParams.get('page_size') ?? '50') || 50;

    let items = db.employees;
    if (q) {
      items = items.filter(
        (e) => e.document.toLowerCase().includes(q) || e.full_name.toLowerCase().includes(q),
      );
    }
    const total = items.length;
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      items: items.slice(start, start + pageSize),
      total,
      page,
      page_size: pageSize,
    });
  }),

  http.post('*/api/employees', async ({ request }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const body = (await request.json()) as Schemas['EmployeeCreateIn'];
    if (db.employees.some((e) => e.document === body.document)) {
      return HttpResponse.json(
        {
          detail: [{ loc: ['body', 'document'], msg: 'Documento ya existe', type: 'value_error' }],
        },
        { status: 422 },
      );
    }
    const emp: Schemas['EmployeeOut'] = {
      document: body.document,
      full_name: body.full_name,
      position: body.position ?? null,
      hire_date: body.hire_date ?? null,
      contract_type: body.contract_type ?? null,
      status: body.status ?? null,
      data: body.data ?? {},
    };
    db.employees.push(emp);
    return HttpResponse.json(emp, { status: 201 });
  }),

  http.get('*/api/employees/:document', ({ request, params }) => {
    if (!userFromToken(request.headers.get('Authorization')))
      return new HttpResponse(null, { status: 401 });
    const emp = db.employees.find((e) => e.document === params.document);
    if (!emp) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(emp);
  }),

  http.patch('*/api/employees/:document', async ({ request, params }) => {
    if (!isAdmin(request)) return new HttpResponse(null, { status: 403 });
    const emp = db.employees.find((e) => e.document === params.document);
    if (!emp) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as Schemas['EmployeeUpdateIn'];
    if (body.full_name != null) emp.full_name = body.full_name;
    if (body.position !== undefined) emp.position = body.position;
    if (body.hire_date !== undefined) emp.hire_date = body.hire_date;
    if (body.contract_type !== undefined) emp.contract_type = body.contract_type;
    if (body.status !== undefined) emp.status = body.status;
    return HttpResponse.json(emp);
  }),
];
