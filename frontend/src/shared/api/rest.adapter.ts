import { http } from './http';
import {
  toArea,
  toCategory,
  toEmployee,
  toNotification,
  toSessionUser,
  toSlaPolicy,
  toTicketDetail,
  toTicketListItem,
  toUser,
} from './mappers';
import type { TicketingApi } from './port';
import type { Employee, Page, Schemas, TicketListItem } from './types';

/**
 * Adaptador REST del puerto: usa `http()` (tipos generados del OpenAPI) y mapea
 * DTO→view model. Es la implementación por defecto; en modo mock, MSW intercepta el
 * mismo `fetch`, así que este código y sus mappers se ejercitan idéntico en ambos modos.
 */
export const restApi: TicketingApi = {
  // --- auth ---
  login: (input) =>
    http<Schemas['TokenOut']>('/auth/login', { method: 'POST', body: input }).then((d) => ({
      accessToken: d.access_token,
      expiresIn: d.expires_in,
    })),

  me: () => http<Schemas['MeOut']>('/auth/me').then(toSessionUser),

  // --- tickets ---
  listTickets: (params) =>
    http<Schemas['TicketPageOut']>('/tickets', {
      query: {
        status: params.status,
        category: params.category,
        assignee: params.assignee,
        open_only: params.openOnly,
        from: params.from,
        to: params.to,
        page: params.page,
        page_size: params.pageSize,
      },
    }).then((d): Page<TicketListItem> => ({
      items: d.items.map(toTicketListItem),
      total: d.total,
      page: d.page,
      pageSize: d.page_size,
    })),

  getTicket: (id) => http<Schemas['TicketOut']>(`/tickets/${id}`).then(toTicketDetail),

  updateTicket: (id, patch) =>
    http<Schemas['TicketOut']>(`/tickets/${id}`, {
      method: 'PATCH',
      body: {
        status: patch.status,
        assignee: patch.assignee,
        priority: patch.priority,
        note: patch.note,
      },
    }).then(toTicketDetail),

  // --- áreas ---
  listAreas: (opts) =>
    http<Schemas['AreaOut'][]>('/areas', {
      query: { only_active: opts?.onlyActive },
    }).then((rows) => rows.map(toArea)),

  createArea: (input) =>
    http<Schemas['AreaOut']>('/areas', {
      method: 'POST',
      body: { name: input.name, code: input.code },
    }).then(toArea),

  // `code` es inmutable: NO se envía en update aunque el DTO lo acepte.
  updateArea: (id, input) =>
    http<Schemas['AreaOut']>(`/areas/${id}`, {
      method: 'PATCH',
      body: { name: input.name, active: input.active },
    }).then(toArea),

  disableArea: (id) => http<Schemas['AreaOut']>(`/areas/${id}`, { method: 'DELETE' }).then(toArea),

  // --- categorías ---
  listCategories: (opts) =>
    http<Schemas['CategoryOut'][]>('/categories', {
      query: { only_active: opts?.onlyActive },
    }).then((rows) => rows.map(toCategory)),

  createCategory: (input) =>
    http<Schemas['CategoryOut']>('/categories', {
      method: 'POST',
      body: { name: input.name, area: input.areaCode, code: input.code },
    }).then(toCategory),

  updateCategory: (id, input) =>
    http<Schemas['CategoryOut']>(`/categories/${id}`, {
      method: 'PATCH',
      body: { name: input.name, active: input.active },
    }).then(toCategory),

  disableCategory: (id) =>
    http<Schemas['CategoryOut']>(`/categories/${id}`, { method: 'DELETE' }).then(toCategory),

  // --- usuarios ---
  listUsers: () => http<Schemas['UserOut'][]>('/users').then((rows) => rows.map(toUser)),

  createUser: (input) =>
    http<Schemas['UserOut']>('/users', {
      method: 'POST',
      body: {
        email: input.email,
        password: input.password,
        role: input.role,
        display_name: input.displayName,
        phone: input.phone,
        area_codes: input.areaCodes,
      },
    }).then(toUser),

  updateUser: (id, input) =>
    http<Schemas['UserOut']>(`/users/${id}`, {
      method: 'PATCH',
      body: {
        display_name: input.displayName,
        phone: input.phone,
        role: input.role,
        active: input.active,
        area_codes: input.areaCodes,
        password: input.password,
      },
    }).then(toUser),

  // --- notificaciones ---
  listNotifications: (opts) =>
    http<Schemas['NotificationOut'][]>('/notifications', {
      query: { unread_only: opts?.unreadOnly, limit: opts?.limit },
    }).then((rows) => rows.map(toNotification)),

  // /unread-count devuelve un objeto {clave: entero} (probablemente {count: n}).
  unreadCount: () =>
    http<Record<string, number>>('/notifications/unread-count').then(
      (o) => o.count ?? Object.values(o)[0] ?? 0,
    ),

  markNotificationRead: (id) =>
    http<Record<string, boolean>>(`/notifications/${id}/read`, { method: 'POST' }).then(
      () => undefined,
    ),

  markAllNotificationsRead: () =>
    http<Record<string, number>>('/notifications/read-all', { method: 'POST' }).then(
      () => undefined,
    ),

  // --- empleados ---
  listEmployees: (params) =>
    http<Schemas['EmployeePageOut']>('/employees', {
      query: { q: params.q, page: params.page, page_size: params.pageSize },
    }).then((d): Page<Employee> => ({
      items: d.items.map(toEmployee),
      total: d.total,
      page: d.page,
      pageSize: d.page_size,
    })),

  createEmployee: (input) =>
    http<Schemas['EmployeeOut']>('/employees', {
      method: 'POST',
      body: {
        document: input.document,
        full_name: input.fullName,
        position: input.position,
        hire_date: input.hireDate,
        contract_type: input.contractType,
        status: input.status,
        data: {},
      },
    }).then(toEmployee),

  updateEmployee: (document, input) =>
    http<Schemas['EmployeeOut']>(`/employees/${document}`, {
      method: 'PATCH',
      body: {
        full_name: input.fullName,
        position: input.position,
        hire_date: input.hireDate,
        contract_type: input.contractType,
        status: input.status,
      },
    }).then(toEmployee),

  // --- SLA ---
  listSlaPolicies: () =>
    http<Schemas['SlaPolicyOut'][]>('/sla-policies').then((rows) => rows.map(toSlaPolicy)),

  upsertSlaPolicy: (priority, input) =>
    http<Schemas['SlaPolicyOut']>(`/sla-policies/${priority}`, {
      method: 'PUT',
      body: {
        response_minutes: input.responseMinutes,
        resolution_minutes: input.resolutionMinutes,
      },
    }).then(toSlaPolicy),
};
