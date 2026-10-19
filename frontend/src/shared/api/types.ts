import type { components } from './generated/schema';

/** DTOs crudos del backend (generados). No exponer a la UI directamente. */
export type Schemas = components['schemas'];

// --- Enums reutilizados del contrato (fuente de verdad: el backend) ---
export type TicketStatus = Schemas['TicketStatus'];
export type Priority = Schemas['Priority'];
export type Role = Schemas['Role'];

export const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'in_review',
  'assigned',
  'in_progress',
  'on_hold',
  'closed',
  'rejected',
];

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];

// --- View models (lo que consume la UI) ---
export interface SessionUser {
  userId: string;
  email: string;
  displayName: string | null;
  role: Role;
}

export interface Area {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  areaCode: string;
  active: boolean;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  phone: string | null;
  role: Role;
  active: boolean;
  areaCodes: string[];
}

export interface Attachment {
  url: string;
  mime: string | null;
  name: string | null;
}

export interface HistoryEntry {
  at: Date;
  status: TicketStatus;
  actor: string | null;
  note: string | null;
}

export interface Sla {
  responseDueAt: Date | null;
  resolutionDueAt: Date | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  responseBreached: boolean;
  resolutionBreached: boolean;
}

export interface Contact {
  waId: string;
  name: string | null;
  document: string | null;
}

/** Fila del listado. `TicketSummaryOut` trae códigos, no nombres (se resuelven con el catálogo). */
export interface TicketListItem {
  id: string;
  radicado: string;
  status: TicketStatus;
  priority: Priority | null;
  subject: string | null;
  categoryCode: string;
  areaCode: string;
  assignee: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketDetail {
  id: string;
  radicado: string;
  status: TicketStatus;
  priority: Priority | null;
  subject: string | null;
  description: string | null;
  category: { code: string; name: string };
  area: { code: string; name: string };
  assignee: string | null;
  conversationId: string | null;
  contact: Contact;
  fields: Record<string, unknown>;
  attachments: Attachment[];
  history: HistoryEntry[];
  sla: Sla;
  createdAt: Date;
  updatedAt: Date;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Inputs (lo que la UI envía; el adapter los mapea a DTOs) ---
export interface LoginInput {
  email: string;
  password: string;
}

export interface TicketListParams {
  status?: TicketStatus | null;
  category?: string | null;
  assignee?: string | null;
  openOnly?: boolean;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}

export interface TicketUpdateInput {
  status?: TicketStatus;
  assignee?: string;
  priority?: Priority;
  note?: string;
}

export interface AreaCreateInput {
  name: string;
  code?: string;
}
export interface AreaUpdateInput {
  name?: string;
  active?: boolean;
}

export interface CategoryCreateInput {
  name: string;
  areaCode: string;
  code?: string;
}
export interface CategoryUpdateInput {
  name?: string;
  active?: boolean;
}

export interface UserCreateInput {
  email: string;
  password: string;
  role: Role;
  displayName?: string;
  phone?: string;
  areaCodes: string[];
}
export interface UserUpdateInput {
  displayName?: string;
  phone?: string;
  role?: Role;
  active?: boolean;
  areaCodes?: string[];
  password?: string;
}

// --- Notificaciones ---
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  ticketId: string | null;
  radicado: string | null;
  read: boolean;
  createdAt: Date;
}

// --- Empleados ---
export interface Employee {
  document: string;
  fullName: string;
  position: string | null;
  hireDate: string | null;
  contractType: string | null;
  status: string | null;
  data: Record<string, unknown>;
}

export interface EmployeeListParams {
  q?: string | null;
  page?: number;
  pageSize?: number;
}

export interface EmployeeCreateInput {
  document: string;
  fullName: string;
  position?: string;
  hireDate?: string;
  contractType?: string;
  status?: string;
}

export interface EmployeeUpdateInput {
  fullName?: string;
  position?: string;
  hireDate?: string;
  contractType?: string;
  status?: string;
}

// --- SLA ---
export interface SlaPolicy {
  priority: Priority;
  responseMinutes: number;
  resolutionMinutes: number;
}

export interface SlaUpsertInput {
  responseMinutes: number;
  resolutionMinutes: number;
}
