/** Llamadas a la API agrupadas por módulo del backend. La UI consume esto vía TanStack Query. */
import { formWithJson, http, openFile } from './http';
import type * as T from './types';

const pub = (slug: string) => `/public/tenants/${encodeURIComponent(slug)}`;

export const authApi = {
  login: (email: string, password: string) =>
    http<T.TokenOut>('/auth/login', { method: 'POST', body: { email, password }, anonymous: true }),
  me: () => http<T.Me>('/auth/me'),
  updateMe: (body: Record<string, unknown>) => http<T.Me>('/auth/me', { method: 'PATCH', body }),
  uploadSignature: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http<void>('/auth/me/signature', { method: 'POST', body: fd });
  },
};

export const identityApi = {
  permissions: () => http<T.Permission[]>('/permissions'),
  users: (q?: string) => http<T.User[]>('/users', { query: { q } }),
  createUser: (body: Record<string, unknown>) => http<T.User>('/users', { method: 'POST', body }),
  updateUser: (id: string, body: Record<string, unknown>) => http<T.User>(`/users/${id}`, { method: 'PATCH', body }),
  uploadUserSignature: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http<void>(`/users/${id}/signature`, { method: 'POST', body: fd });
  },
  lookup: (permission: string, areaId?: string | null) =>
    http<T.UserLookup[]>('/users/lookup', { query: { permission, area_id: areaId ?? undefined } }),
  roles: () => http<T.Role[]>('/roles'),
  createRole: (body: Record<string, unknown>) => http<T.Role>('/roles', { method: 'POST', body }),
  updateRole: (id: string, body: Record<string, unknown>) => http<T.Role>(`/roles/${id}`, { method: 'PATCH', body }),
  deleteRole: (id: string) => http<void>(`/roles/${id}`, { method: 'DELETE' }),
  areas: () => http<T.Area[]>('/areas'),
  createArea: (body: Record<string, unknown>) => http<T.Area>('/areas', { method: 'POST', body }),
  updateArea: (id: string, body: Record<string, unknown>) => http<T.Area>(`/areas/${id}`, { method: 'PATCH', body }),
};

export const tenantApi = {
  get: () => http<T.Tenant>('/tenant'),
  update: (body: Record<string, unknown>) => http<T.Tenant>('/tenant', { method: 'PATCH', body }),
  uploadLogo: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http<void>('/tenant/logo', { method: 'POST', body: fd });
  },
  updateEmailInbound: (body: Record<string, unknown>) => http<T.Tenant>('/tenant/email-inbound', { method: 'PUT', body }),
  testEmail: () => http<{ ok: boolean; detail: string }>('/channels/email/test', { method: 'POST' }),
  pollEmail: () => http<{ ok: boolean; detail: string }>('/channels/email/poll', { method: 'POST' }),
  keys: () => http<T.IntegrationKey[]>('/tenant/integration-keys'),
  createKey: (name: string) => http<T.IntegrationKey>('/tenant/integration-keys', { method: 'POST', body: { name } }),
  revokeKey: (id: string) => http<void>(`/tenant/integration-keys/${id}`, { method: 'DELETE' }),
  logoUrl: (slug: string) => `/api${pub(slug)}/logo`,
};

export const platformApi = {
  tenants: () => http<T.Tenant[]>('/platform/tenants'),
  createTenant: (body: Record<string, unknown>) => http<T.Tenant>('/platform/tenants', { method: 'POST', body }),
  updateTenant: (id: string, body: Record<string, unknown>) =>
    http<T.Tenant>(`/platform/tenants/${id}`, { method: 'PATCH', body }),
};

export const catalogApi = {
  types: () => http<T.RequestType[]>('/catalog/request-types'),
  createType: (body: Record<string, unknown>) => http<T.RequestType>('/catalog/request-types', { method: 'POST', body }),
  updateType: (id: string, body: Record<string, unknown>) =>
    http<T.RequestType>(`/catalog/request-types/${id}`, { method: 'PATCH', body }),
  categories: (segment?: T.Segment) => http<T.Category[]>('/catalog/categories', { query: { segment } }),
  createCategory: (body: Record<string, unknown>) => http<T.Category>('/catalog/categories', { method: 'POST', body }),
  updateCategory: (id: string, body: Record<string, unknown>) =>
    http<T.Category>(`/catalog/categories/${id}`, { method: 'PATCH', body }),
  createSub: (categoryId: string, body: Record<string, unknown>) =>
    http<T.Subcategory>(`/catalog/categories/${categoryId}/subcategories`, { method: 'POST', body }),
  updateSub: (id: string, body: Record<string, unknown>) =>
    http<T.Subcategory>(`/catalog/subcategories/${id}`, { method: 'PATCH', body }),
};

export const slaApi = {
  policies: () => http<T.SlaPolicy[]>('/sla/policies'),
  putPolicy: (priority: T.Priority, body: Omit<T.SlaPolicy, 'priority'>) =>
    http<T.SlaPolicy>(`/sla/policies/${priority}`, { method: 'PUT', body }),
  calendar: () => http<T.BusinessCalendar>('/sla/calendar'),
  putCalendar: (body: T.BusinessCalendar) => http<T.BusinessCalendar>('/sla/calendar', { method: 'PUT', body }),
  holidays: (year: number) => http<T.Holiday[]>('/sla/holidays', { query: { year } }),
  addHoliday: (day: string, name: string) => http<T.Holiday>('/sla/holidays', { method: 'POST', body: { day, name } }),
  deleteHoliday: (id: string) => http<void>(`/sla/holidays/${id}`, { method: 'DELETE' }),
  simulate: (priority: T.Priority) => http<{ due_at: string }>('/sla/simulate', { query: { priority } }),
};

export const clientsApi = {
  list: (q?: string, active?: boolean) => http<T.Client[]>('/clients', { query: { q, active } }),
  get: (id: string) => http<T.Client>(`/clients/${id}`),
  create: (body: Record<string, unknown>) => http<T.Client>('/clients', { method: 'POST', body }),
  update: (id: string, body: Record<string, unknown>) => http<T.Client>(`/clients/${id}`, { method: 'PATCH', body }),
  createSite: (clientId: string, body: Record<string, unknown>) =>
    http<T.Site>(`/clients/${clientId}/sites`, { method: 'POST', body }),
  updateSite: (id: string, body: Record<string, unknown>) => http<T.Site>(`/sites/${id}`, { method: 'PATCH', body }),
  sites: (clientId?: string, q?: string) => http<T.Site[]>('/sites', { query: { client_id: clientId, q } }),
};

export const employeesApi = {
  list: (q: string | undefined, page: number, pageSize = 25) =>
    http<T.Page<T.Employee>>('/employees', { query: { q, page, page_size: pageSize } }),
  create: (body: Record<string, unknown>) => http<T.Employee>('/employees', { method: 'POST', body }),
  update: (id: string, body: Record<string, unknown>) => http<T.Employee>(`/employees/${id}`, { method: 'PATCH', body }),
  importCsv: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http<{ created: number; updated: number; errors: string[] }>('/employees/import', { method: 'POST', body: fd });
  },
  template: () => openFile('/employees/import-template', 'plantilla_empleados.csv'),
};

export type PqrsFilters = Partial<{
  q: string;
  status: string[];
  segment: T.Segment;
  request_type_id: string;
  category_id: string;
  area_id: string;
  priority: T.Priority;
  channel: T.Channel;
  client_id: string;
  site_id: string;
  assignee_id: string;
  mine: boolean;
  open_only: boolean;
  sla_state: T.SlaState;
  from: string;
  to: string;
  page: number;
  page_size: number;
}>;

export const pqrsApi = {
  list: (f: PqrsFilters) => http<T.Page<T.PqrsSummary>>('/pqrs', { query: f }),
  get: (id: string) => http<T.PqrsDetail>(`/pqrs/${id}`),
  create: (data: Record<string, unknown>, files: File[]) =>
    http<T.PqrsDetail>('/pqrs', { method: 'POST', body: formWithJson(data, files) }),
  classify: (id: string, body: Record<string, unknown>) => http<T.PqrsDetail>(`/pqrs/${id}/classify`, { method: 'POST', body }),
  assign: (id: string, assignee_id: string | null, note?: string) =>
    http<T.PqrsDetail>(`/pqrs/${id}/assign`, { method: 'POST', body: { assignee_id, note } }),
  status: (id: string, status: string, note?: string) =>
    http<T.PqrsDetail>(`/pqrs/${id}/status`, { method: 'POST', body: { status, note } }),
  comment: (id: string, note: string, isPublic: boolean) =>
    http<T.PqrsDetail>(`/pqrs/${id}/comments`, { method: 'POST', body: { note, public: isPublic } }),
  upload: (id: string, files: File[], isPublic: boolean) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    fd.append('public', String(isPublic));
    return http<T.PqrsDetail>(`/pqrs/${id}/attachments`, { method: 'POST', body: fd });
  },
  openAttachment: (id: string, att: T.Attachment) => openFile(`/pqrs/${id}/attachments/${att.id}`),
  saveResponse: (id: string, body: string, action: 'draft' | 'submit' | 'send') =>
    http<T.PqrsDetail>(`/pqrs/${id}/responses`, { method: 'POST', body: { body, action } }),
  approve: (id: string, responseId: string, note?: string, body?: string) =>
    http<T.PqrsDetail>(`/pqrs/${id}/responses/${responseId}/approve`, { method: 'POST', body: { note, body } }),
  returnResponse: (id: string, responseId: string, note: string) =>
    http<T.PqrsDetail>(`/pqrs/${id}/responses/${responseId}/return`, { method: 'POST', body: { note } }),
  preview: (id: string, body: string) =>
    openFile(`/pqrs/${id}/responses/preview`, undefined, { method: 'POST', body: { body, action: 'draft' } }),
};

export const publicApi = {
  tenant: (slug: string) => http<T.PublicTenant>(pub(slug), { anonymous: true }),
  catalog: (slug: string) => http<T.PublicCatalog>(`${pub(slug)}/catalog`, { anonymous: true }),
  lookupClient: (slug: string, nit: string) =>
    http<{ id: string; name: string; sites: T.Named[] }>(`${pub(slug)}/clients/lookup`, {
      query: { nit },
      anonymous: true,
    }),
  create: (slug: string, data: Record<string, unknown>, files: File[]) =>
    http<T.PublicCreated>(`${pub(slug)}/pqrs`, { method: 'POST', body: formWithJson(data, files), anonymous: true }),
  status: (slug: string, radicado: string, code: string) =>
    http<T.PublicStatus>(`${pub(slug)}/pqrs/${encodeURIComponent(radicado)}`, { query: { code }, anonymous: true }),
  reply: (slug: string, radicado: string, code: string, message: string, files: File[]) => {
    const fd = new FormData();
    fd.append('code', code);
    fd.append('message', message);
    files.forEach((f) => fd.append('files', f));
    return http<T.PublicStatus>(`${pub(slug)}/pqrs/${encodeURIComponent(radicado)}/messages`, {
      method: 'POST',
      body: fd,
      anonymous: true,
    });
  },
  openAttachment: (slug: string, radicado: string, code: string, att: T.Attachment) =>
    openFile(`${pub(slug)}/pqrs/${encodeURIComponent(radicado)}/attachments/${att.id}`, undefined, {
      query: { code },
      anonymous: true,
    }),
};

export type TaskFilters = Partial<{
  q: string;
  status: T.TaskStatus;
  priority: T.Priority;
  assignee_id: string;
  source_type: string;
  source_id: string;
  client_id: string;
  site_id: string;
  mine: boolean;
  open_only: boolean;
  overdue: boolean;
  page: number;
  page_size: number;
}>;

export const tasksApi = {
  list: (f: TaskFilters) => http<T.Page<T.Task>>('/tasks', { query: f }),
  get: (id: string) => http<T.Task>(`/tasks/${id}`),
  create: (body: Record<string, unknown>) => http<T.Task>('/tasks', { method: 'POST', body }),
  update: (id: string, body: Record<string, unknown>) => http<T.Task>(`/tasks/${id}`, { method: 'PATCH', body }),
  addUpdate: (id: string, note: string, status: T.TaskStatus | null, files: File[]) => {
    const fd = new FormData();
    if (note) fd.append('note', note);
    if (status) fd.append('status', status);
    files.forEach((f) => fd.append('files', f));
    return http<T.Task>(`/tasks/${id}/updates`, { method: 'POST', body: fd });
  },
  openFile: (taskId: string, updateId: string, index: number) =>
    openFile(`/tasks/${taskId}/updates/${updateId}/files/${index}`),
};

export const visitsApi = {
  forms: (active?: boolean) => http<T.VisitForm[]>('/visits/forms', { query: { active } }),
  form: (id: string) => http<T.VisitForm>(`/visits/forms/${id}`),
  createForm: (body: Record<string, unknown>) => http<T.VisitForm>('/visits/forms', { method: 'POST', body }),
  updateForm: (id: string, body: Record<string, unknown>) => http<T.VisitForm>(`/visits/forms/${id}`, { method: 'PUT', body }),
  quotas: () => http<T.VisitQuota[]>('/visits/quotas'),
  putQuota: (body: Record<string, unknown>) => http<T.VisitQuota>('/visits/quotas', { method: 'PUT', body }),
  deleteQuota: (id: string) => http<void>(`/visits/quotas/${id}`, { method: 'DELETE' }),
  compliance: (month: string) => http<T.Compliance>('/visits/compliance', { query: { month } }),
  list: (f: Record<string, string | number | boolean | undefined>) => http<T.Page<T.VisitSummary>>('/visits', { query: f }),
  get: (id: string) => http<T.Visit>(`/visits/${id}`),
  start: (body: Record<string, unknown>) => http<T.Visit>('/visits', { method: 'POST', body }),
  saveAnswers: (id: string, answers: Record<string, unknown>, observations?: string | null) =>
    http<T.Visit>(`/visits/${id}/answers`, { method: 'PUT', body: { answers, observations } }),
  uploadPhoto: (id: string, fieldId: string, file: File) => {
    const fd = new FormData();
    fd.append('field_id', fieldId);
    fd.append('file', file);
    return http<{ id: string }>(`/visits/${id}/files`, { method: 'POST', body: fd });
  },
  photoPath: (id: string, fileId: string) => `/visits/${id}/files/${fileId}`,
  evaluate: (id: string, answers: Record<string, unknown>, observations?: string | null) =>
    http<{ score: number | null; findings: T.Finding[] }>(`/visits/${id}/evaluate`, {
      method: 'POST',
      body: { answers, observations },
    }),
  complete: (id: string, body: Record<string, unknown>) => http<T.Visit>(`/visits/${id}/complete`, { method: 'POST', body }),
  remove: (id: string) => http<void>(`/visits/${id}`, { method: 'DELETE' }),
};

export const notificationsApi = {
  list: () => http<T.AppNotification[]>('/notifications', { query: { limit: 30 } }),
  unread: () => http<{ unread: number }>('/notifications/unread-count'),
  read: (id: string) => http<void>(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => http<void>('/notifications/read-all', { method: 'POST' }),
};

type ReportQuery = Partial<{ from: string; to: string; segment: string; area_id: string; client_id: string }>;

export const reportsApi = {
  dashboard: () => http<T.Dashboard>('/reports/dashboard'),
  pqrs: (q: ReportQuery) => http<T.PqrsReport>('/reports/pqrs', { query: q }),
  pqrsXlsx: (q: ReportQuery) => openFile('/reports/pqrs/export.xlsx', 'reporte_pqrs.xlsx', { query: q }),
  pqrsPdf: (q: ReportQuery) => openFile('/reports/pqrs/summary.pdf', undefined, { query: q }),
  visits: (month: string) => http<T.VisitsReport>('/reports/visits', { query: { month } }),
  visitsXlsx: (month: string) => openFile('/reports/visits/export.xlsx', `visitas_${month}.xlsx`, { query: { month } }),
  tasks: () => http<T.TasksReport>('/reports/tasks'),
};
