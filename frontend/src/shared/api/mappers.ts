import type {
  Schemas,
  Area,
  Category,
  Contact,
  Employee,
  HistoryEntry,
  Notification,
  Sla,
  SlaPolicy,
  TicketDetail,
  TicketListItem,
  User,
} from './types';

/** Mapea Date desde un string ISO opcional. */
function toDate(iso: string): Date {
  return new Date(iso);
}
function toDateOrNull(iso: string | null | undefined): Date | null {
  return iso ? new Date(iso) : null;
}

export function toSessionUser(d: Schemas['MeOut']) {
  return {
    userId: d.user_id,
    email: d.email,
    displayName: d.display_name ?? null,
    role: d.role,
  };
}

export function toArea(d: Schemas['AreaOut']): Area {
  return { id: d.id, code: d.code, name: d.name, active: d.active };
}

export function toCategory(d: Schemas['CategoryOut']): Category {
  return { id: d.id, code: d.code, name: d.name, areaCode: d.area, active: d.active };
}

export function toUser(d: Schemas['UserOut']): User {
  return {
    id: d.id,
    email: d.email,
    displayName: d.display_name ?? null,
    phone: d.phone ?? null,
    role: d.role,
    active: d.active,
    areaCodes: d.area_codes ?? [],
  };
}

export function toTicketListItem(d: Schemas['TicketSummaryOut']): TicketListItem {
  return {
    id: d.ticket_id,
    radicado: d.radicado,
    status: d.status,
    priority: d.priority ?? null,
    subject: d.subject ?? null,
    categoryCode: d.category,
    areaCode: d.area,
    assignee: d.assignee ?? null,
    createdAt: toDate(d.created_at),
    updatedAt: toDate(d.updated_at),
  };
}

function toContact(d: Schemas['ContactOut']): Contact {
  return { waId: d.wa_id, name: d.name ?? null, document: d.document ?? null };
}

function toSla(d: Schemas['SlaOut']): Sla {
  return {
    responseDueAt: toDateOrNull(d.response_due_at),
    resolutionDueAt: toDateOrNull(d.resolution_due_at),
    firstResponseAt: toDateOrNull(d.first_response_at),
    resolvedAt: toDateOrNull(d.resolved_at),
    responseBreached: d.response_breached,
    resolutionBreached: d.resolution_breached,
  };
}

export function toNotification(d: Schemas['NotificationOut']): Notification {
  return {
    id: d.id,
    type: d.type,
    title: d.title,
    body: d.body ?? null,
    ticketId: d.ticket_id ?? null,
    radicado: d.radicado ?? null,
    read: d.read,
    createdAt: toDate(d.created_at),
  };
}

export function toEmployee(d: Schemas['EmployeeOut']): Employee {
  return {
    document: d.document,
    fullName: d.full_name,
    position: d.position ?? null,
    hireDate: d.hire_date ?? null,
    contractType: d.contract_type ?? null,
    status: d.status ?? null,
    data: (d.data ?? {}) as Record<string, unknown>,
  };
}

export function toSlaPolicy(d: Schemas['SlaPolicyOut']): SlaPolicy {
  return {
    priority: d.priority,
    responseMinutes: d.response_minutes,
    resolutionMinutes: d.resolution_minutes,
  };
}

export function toTicketDetail(d: Schemas['TicketOut']): TicketDetail {
  const history: HistoryEntry[] = (d.history ?? [])
    .map((h) => ({
      at: toDate(h.at),
      status: h.status,
      actor: h.actor ?? null,
      note: h.note ?? null,
    }))
    .sort((a, b) => b.at.getTime() - a.at.getTime()); // más reciente primero

  return {
    id: d.ticket_id,
    radicado: d.radicado,
    status: d.status,
    priority: d.priority ?? null,
    subject: d.subject ?? null,
    description: d.description ?? null,
    category: { code: d.category, name: d.category_name ?? d.category },
    area: { code: d.area, name: d.area_name ?? d.area },
    assignee: d.assignee ?? null,
    conversationId: d.conversation_id ?? null,
    contact: toContact(d.contact),
    fields: (d.fields ?? {}) as Record<string, unknown>,
    attachments: (d.attachments ?? []).map((a) => ({
      url: a.url,
      mime: a.mime ?? null,
      name: a.name ?? null,
    })),
    history,
    sla: toSla(d.sla),
    createdAt: toDate(d.created_at),
    updatedAt: toDate(d.updated_at),
  };
}
