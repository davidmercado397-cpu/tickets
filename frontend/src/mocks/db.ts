import type { Schemas } from '@/shared/api/types';

/** Estado en memoria para el mock (dev sin backend + tests). Se puede resetear. */
interface MockDb {
  areas: Schemas['AreaOut'][];
  categories: Schemas['CategoryOut'][];
  users: Schemas['UserOut'][];
  passwords: Record<string, string>; // email → password
  tickets: Schemas['TicketOut'][];
  notifications: Schemas['NotificationOut'][];
  employees: Schemas['EmployeeOut'][];
  slaPolicies: Schemas['SlaPolicyOut'][];
}

function seed(): MockDb {
  const now = '2026-07-03T12:00:00Z';
  return {
    areas: [
      { id: 'a1', code: 'soporte', name: 'Soporte', active: true },
      { id: 'a2', code: 'rrhh', name: 'Recursos Humanos', active: true },
    ],
    categories: [
      { id: 'c1', code: 'incidente', name: 'Incidente', area: 'soporte', active: true },
      { id: 'c2', code: 'certificado', name: 'Certificado laboral', area: 'rrhh', active: true },
    ],
    users: [
      {
        id: 'u1',
        email: 'admin@demo.co',
        display_name: 'Admin Demo',
        phone: null,
        role: 'admin',
        active: true,
        area_codes: [],
      },
      {
        id: 'u2',
        email: 'agente@demo.co',
        display_name: 'Agente Soporte',
        phone: null,
        role: 'agent',
        active: true,
        area_codes: ['soporte'],
      },
    ],
    passwords: { 'admin@demo.co': 'admin1234', 'agente@demo.co': 'agente1234' },
    tickets: [
      {
        ticket_id: 't1',
        radicado: 'SRV-2026-000001',
        status: 'open',
        category: 'incidente',
        category_name: 'Incidente',
        area: 'soporte',
        area_name: 'Soporte',
        priority: 'high',
        subject: 'No puedo iniciar sesión en SIESA',
        description: 'El sistema muestra error 500 al entrar.',
        assignee: null,
        conversation_id: null,
        contact: { wa_id: '573001112233', name: 'Juan Pérez', document: '1088000111' },
        fields: {},
        attachments: [],
        history: [{ at: now, status: 'open', actor: 'system', note: 'Ticket creado.' }],
        sla: {
          response_due_at: '2026-07-03T14:00:00Z',
          resolution_due_at: '2026-07-04T12:00:00Z',
          first_response_at: null,
          resolved_at: null,
          response_breached: false,
          resolution_breached: false,
        },
        created_at: now,
        updated_at: now,
      },
      {
        ticket_id: 't2',
        radicado: 'SRV-2026-000002',
        status: 'in_progress',
        category: 'certificado',
        category_name: 'Certificado laboral',
        area: 'rrhh',
        area_name: 'Recursos Humanos',
        priority: 'medium',
        subject: 'Solicitud de certificado laboral',
        description: null,
        assignee: 'agente@demo.co',
        conversation_id: null,
        contact: { wa_id: '573004445566', name: 'María López', document: '1088000222' },
        fields: {},
        attachments: [],
        history: [
          { at: now, status: 'open', actor: 'system', note: 'Ticket creado.' },
          { at: now, status: 'in_progress', actor: 'agente@demo.co', note: 'En gestión.' },
        ],
        sla: {
          response_due_at: '2026-07-03T18:00:00Z',
          resolution_due_at: '2026-07-05T12:00:00Z',
          first_response_at: now,
          resolved_at: null,
          response_breached: false,
          resolution_breached: false,
        },
        created_at: now,
        updated_at: now,
      },
    ],
    notifications: [
      {
        id: 'n1',
        type: 'ticket_created',
        title: 'Nuevo ticket en Soporte',
        body: 'SRV-2026-000001 — No puedo iniciar sesión en SIESA',
        ticket_id: 't1',
        radicado: 'SRV-2026-000001',
        read: false,
        created_at: now,
      },
      {
        id: 'n2',
        type: 'ticket_assigned',
        title: 'Ticket asignado',
        body: 'SRV-2026-000002 — Solicitud de certificado laboral',
        ticket_id: 't2',
        radicado: 'SRV-2026-000002',
        read: true,
        created_at: now,
      },
    ],
    employees: [
      {
        document: '1088000111',
        full_name: 'Juan Pérez',
        position: 'Analista',
        hire_date: '2022-03-01',
        contract_type: 'Indefinido',
        status: 'activo',
        data: {},
      },
      {
        document: '1088000222',
        full_name: 'María López',
        position: 'Coordinadora',
        hire_date: '2020-08-15',
        contract_type: 'Indefinido',
        status: 'activo',
        data: {},
      },
    ],
    slaPolicies: [
      { priority: 'high', response_minutes: 60, resolution_minutes: 480 },
      { priority: 'medium', response_minutes: 240, resolution_minutes: 1440 },
    ],
  };
}

export let db: MockDb = seed();

export function resetDb(): void {
  db = seed();
}

export function tokenFor(userId: string): string {
  return `mock-token-${userId}`;
}

export function userFromToken(authorization: string | null): Schemas['UserOut'] | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length);
  const id = token.replace('mock-token-', '');
  return db.users.find((u) => u.id === id) ?? null;
}

export function toSummary(t: Schemas['TicketOut']): Schemas['TicketSummaryOut'] {
  return {
    ticket_id: t.ticket_id,
    radicado: t.radicado,
    status: t.status,
    category: t.category,
    area: t.area,
    priority: t.priority ?? null,
    subject: t.subject ?? null,
    assignee: t.assignee ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}
