/** Tipos de la API (espejo de los schemas Pydantic del backend). Fechas como string ISO. */

export type UUID = string;
export type Segment = 'external' | 'internal';
export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type PqrsStatus =
  | 'received'
  | 'assigned'
  | 'in_progress'
  | 'on_hold'
  | 'pending_approval'
  | 'responded'
  | 'cancelled';
export type Channel = 'web' | 'manual' | 'email' | 'whatsapp' | 'integration';
export type SlaState = 'on_time' | 'at_risk' | 'overdue' | 'met' | 'missed';
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export type DocType = 'CC' | 'CE' | 'TI' | 'PA' | 'PPT' | 'NIT';

export interface Named {
  id: UUID;
  name: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// --- Identidad ---

export interface TenantBrief {
  id: UUID;
  slug: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  has_logo: boolean;
}

export interface RoleBrief {
  id: UUID;
  code: string;
  name: string;
}

export interface AreaBrief {
  id: UUID;
  code: string;
  name: string;
}

export interface Me {
  id: UUID;
  email: string;
  full_name: string;
  phone: string | null;
  position: string | null;
  is_superadmin: boolean;
  has_signature: boolean;
  tenant: TenantBrief | null;
  roles: RoleBrief[];
  areas: AreaBrief[];
  permissions: string[];
}

export interface TokenOut {
  access_token: string;
  expires_in: number;
}

export interface User {
  id: UUID;
  email: string;
  full_name: string;
  phone: string | null;
  position: string | null;
  active: boolean;
  has_signature: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: RoleBrief[];
  areas: AreaBrief[];
}

export interface UserLookup {
  id: UUID;
  email: string;
  full_name: string;
}

export interface Role {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  all_permissions: boolean;
  permissions: string[];
}

export interface Permission {
  code: string;
  label: string;
  group: string;
}

export interface Area {
  id: UUID;
  code: string;
  name: string;
  email: string | null;
  active: boolean;
}

// --- Empresa ---

export interface PortalSettings {
  enabled: boolean;
  welcome: string;
  habeas_data: string;
  allow_anonymous: boolean;
}

export interface LetterSettings {
  city: string;
  closing: string;
  footer: string;
  signer_user_id: UUID | null;
}

export interface NotificationSettings {
  email_requester_on_create: boolean;
  email_staff: boolean;
}

export interface EmailInboundSettings {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  folder: string;
  use_ssl: boolean;
  has_password: boolean;
}

export interface Tenant {
  id: UUID;
  slug: string;
  name: string;
  legal_name: string | null;
  nit: string | null;
  radicado_prefix: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primary_color: string;
  secondary_color: string;
  has_logo: boolean;
  active: boolean;
  created_at: string;
  portal: PortalSettings;
  letter: LetterSettings;
  notifications: NotificationSettings;
  quality: { area_id: UUID | null };
  email_inbound: EmailInboundSettings;
}

export interface PlatformUser {
  id: UUID;
  email: string;
  full_name: string;
  active: boolean;
  is_admin: boolean;
  roles: string[];
  last_login_at: string | null;
}

export interface PublicTenant {
  slug: string;
  name: string;
  legal_name: string | null;
  nit: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  primary_color: string;
  secondary_color: string;
  has_logo: boolean;
  portal: PortalSettings;
}

export interface IntegrationKey {
  id: UUID;
  name: string;
  prefix: string;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
  key?: string;
}

// --- Catálogo ---

export interface RequestType {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  rca_segments: Segment[];
}

export interface Subcategory {
  id: UUID;
  category_id: UUID;
  code: string;
  name: string;
  default_area_id: UUID | null;
  default_priority: Priority | null;
  active: boolean;
}

export interface Category {
  id: UUID;
  segment: Segment;
  request_type_id: UUID | null;
  code: string;
  name: string;
  description: string | null;
  default_area_id: UUID | null;
  default_priority: Priority | null;
  active: boolean;
  sort_order: number;
  subcategories: Subcategory[];
}

export interface PublicCatalog {
  request_types: { id: UUID; code: string; name: string; description: string | null }[];
  categories: {
    id: UUID;
    segment: Segment;
    request_type_id: UUID | null;
    name: string;
    description: string | null;
    subcategories: Named[];
  }[];
}

// --- SLA ---

export type SlaUnit = 'business_days' | 'business_hours' | 'calendar_days' | 'calendar_hours';

export interface SlaPolicy {
  priority: Priority;
  target_value: number;
  unit: SlaUnit;
  pause_on_hold: boolean;
  warning_percent: number;
}

export interface BusinessCalendar {
  timezone: string;
  workdays: number[];
  work_start: string;
  work_end: string;
  country: string | null;
}

export interface Holiday {
  id: UUID | null;
  day: string;
  name: string;
  national: boolean;
}

// --- Clientes / empleados ---

export interface Site {
  id: UUID;
  client_id: UUID;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
}

export interface Client {
  id: UUID;
  nit: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  contract_start: string | null;
  contract_end: string | null;
  notes: string | null;
  active: boolean;
  sites: Site[];
}

export interface ClientImportResult {
  dry_run: boolean;
  saved: boolean;
  clients_created: number;
  clients_updated: number;
  sites_created: number;
  sites_updated: number;
  quotas_set: number;
  errors: { sheet: string; row: number; message: string }[];
}

export interface Employee {
  id: UUID;
  document_type: string;
  document: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  site_id: UUID | null;
  hire_date: string | null;
  contract_type: string | null;
  status: 'active' | 'retired';
}

// --- PQRS ---

export interface Requester {
  name?: string | null;
  doc_type?: DocType | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
}

export interface PqrsSummary {
  id: UUID;
  radicado: string;
  segment: Segment;
  channel: Channel;
  status: PqrsStatus;
  priority: Priority;
  subject: string;
  request_type: Named | null;
  category: Named | null;
  area: Named | null;
  client: Named | null;
  site: Named | null;
  requester_name: string | null;
  assignee: Named | null;
  created_at: string;
  sla_due_at: string | null;
  sla_state: SlaState | null;
  requires_rca: boolean;
  rca_status: RcaStatus | null;
}

export interface PqrsEvent {
  id: UUID;
  at: string;
  kind: string;
  actor_label: string | null;
  from_status: PqrsStatus | null;
  to_status: PqrsStatus | null;
  note: string | null;
  internal: boolean;
  data: Record<string, unknown>;
}

export interface Attachment {
  id: UUID;
  filename: string;
  mime: string;
  size: number;
  source: 'requester' | 'staff' | 'response';
  public: boolean;
  created_at: string;
}

export interface PqrsResponse {
  id: UUID;
  body: string;
  status: 'draft' | 'pending_approval' | 'returned' | 'sent';
  author_id: UUID | null;
  author_name: string | null;
  submitted_at: string | null;
  reviewer_id: UUID | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  has_pdf: boolean;
  sent_at: string | null;
  sent_to: string | null;
  created_at: string;
}

export interface PqrsDetail extends PqrsSummary {
  public_code: string;
  description: string;
  subcategory: Named | null;
  employee: Named | null;
  is_anonymous: boolean;
  requester: Requester;
  consent_at: string | null;
  external_ref: string | null;
  created_by: Named | null;
  sla: {
    due_at: string | null;
    warning_at: string | null;
    state: SlaState | null;
    policy: { target_value?: number; unit?: SlaUnit; pauses?: number; warning_percent?: number };
    paused: boolean;
    first_response_at: string | null;
    resolved_at: string | null;
  };
  events: PqrsEvent[];
  attachments: Attachment[];
  responses: PqrsResponse[];
}

export interface PublicCreated {
  radicado: string;
  public_code: string;
  sla_due_at: string | null;
}

export interface PublicStatus {
  radicado: string;
  status: PqrsStatus;
  subject: string;
  request_type: string | null;
  created_at: string;
  sla_due_at: string | null;
  events: { at: string; kind: string; to_status: PqrsStatus | null; note: string | null }[];
  response_available: boolean;
  response_sent_at: string | null;
  can_reply: boolean;
  attachments: Attachment[];
}

// --- Análisis de causa raíz ---

export type RcaStatus = 'setup' | 'analysis' | 'validation' | 'plan' | 'closed';
export type RcaMethod = 'five_whys' | 'ishikawa' | 'free';
export type CauseCategory = 'people' | 'method' | 'materials' | 'machine' | 'measurement' | 'environment';

export interface RcaParticipant {
  area: Named;
  analysis: string | null;
  whys: string[];
  contributed_by: string | null;
  contributed_at: string | null;
  can_contribute: boolean;
}

export interface Rca {
  status: RcaStatus;
  method: RcaMethod;
  problem_statement: string | null;
  root_cause: string | null;
  cause_category: CauseCategory | null;
  consolidated_at: string | null;
  consolidated_by: string | null;
  plan_required: boolean | null;
  validation_note: string | null;
  validated_at: string | null;
  validated_by: string | null;
  plan_summary: string | null;
  closed_at: string | null;
  closed_by: string | null;
  participants: RcaParticipant[];
  actions: { id: UUID; title: string; status: TaskStatus; due_date: string | null; assignee: string | null; overdue: boolean }[];
  can_manage: boolean;
}

// --- Tareas ---

export interface TaskUpdate {
  id: UUID;
  at: string;
  author_label: string | null;
  note: string | null;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  files: { index: number; filename: string; mime: string; size: number }[];
}

export interface Task {
  id: UUID;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  overdue: boolean;
  assignee: Named | null;
  created_by: Named | null;
  source_type: string;
  source_id: UUID | null;
  source_label: string | null;
  client: Named | null;
  site: Named | null;
  completed_at: string | null;
  created_at: string;
  updates: TaskUpdate[];
}

// --- Visitas ---

export type FieldType =
  | 'section'
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'yesno'
  | 'rating'
  | 'date'
  | 'photo'
  | 'signature';

export interface FindingRule {
  op: 'equals' | 'not_equals' | 'lte' | 'gte' | 'in';
  value: unknown;
  task_title?: string | null;
  priority?: Priority;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  help?: string | null;
  options?: string[];
  min?: number | null;
  max?: number | null;
  scored?: boolean;
  finding?: FindingRule | null;
}

export interface VisitForm {
  id: UUID;
  name: string;
  description: string | null;
  fields: FormField[];
  version: number;
  active: boolean;
  updated_at: string;
}

export interface VisitQuota {
  id: UUID;
  client: Named | null;
  site: Named | null;
  visits_per_month: number;
  form_id: UUID | null;
  active: boolean;
}

export interface VisitSummary {
  id: UUID;
  form: Named;
  client: Named | null;
  site: Named | null;
  visitor: Named | null;
  status: 'draft' | 'completed';
  started_at: string;
  completed_at: string | null;
  score: number | null;
  findings_count: number;
}

export interface Finding {
  field_id: string;
  label: string;
  answer: unknown;
  suggested_task: string;
  priority: Priority;
}

export interface Visit extends VisitSummary {
  form_version: number;
  fields: FormField[];
  answers: Record<string, unknown>;
  observations: string | null;
  latitude: number | null;
  longitude: number | null;
  findings: Finding[];
  files: { id: UUID; field_id: string; filename: string; mime: string; size: number }[];
  tasks: { id: UUID; title: string; status: TaskStatus; due_date: string | null; overdue: boolean }[];
}

export interface ComplianceRow {
  level: 'client' | 'site';
  client: Named | null;
  site: Named | null;
  required: number;
  done: number;
  percent: number;
}

export interface Compliance {
  month: string;
  required: number;
  done_capped: number;
  percent: number;
  rows: ComplianceRow[];
}

// --- Notificaciones ---

export interface AppNotification {
  id: UUID;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

// --- Reportes ---

export interface ReportGroup {
  key: string | null;
  name: string;
  count: number;
  met: number;
  missed: number;
  open: number;
  overdue: number;
  compliance: number | null;
}

export interface PqrsReport {
  total: number;
  open: number;
  responded: number;
  cancelled: number;
  sla: Record<SlaState, number>;
  compliance: number | null;
  avg_resolution_hours: number | null;
  avg_first_response_hours: number | null;
  by_status: ReportGroup[];
  by_type: ReportGroup[];
  by_category: ReportGroup[];
  by_area: ReportGroup[];
  by_channel: ReportGroup[];
  by_segment: ReportGroup[];
  by_priority: ReportGroup[];
  by_client: ReportGroup[];
  by_assignee: ReportGroup[];
  monthly: { month: string; created: number; responded: number; met: number; missed: number }[];
}

export interface Dashboard {
  pqrs: Pick<
    PqrsReport,
    'total' | 'open' | 'responded' | 'compliance' | 'sla' | 'monthly' | 'by_type' | 'by_area' | 'by_channel'
  > & { avg_resolution_hours: number | null };
  visits: { month: string; percent: number; required: number; done: number; worst: ComplianceRow[] };
  tasks: { open: number; overdue: number; on_time_percent: number | null };
}

export interface VisitsReport {
  compliance: Compliance;
  total_visits: number;
  total_findings: number;
  avg_score: number | null;
  by_visitor: { name: string; visits: number; findings: number; avg_score: number | null }[];
}

export interface TasksReport {
  total: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  overdue: number;
  on_time_percent: number | null;
  by_assignee: { name: string; open: number; done: number; overdue: number }[];
}
