import type { Channel, PqrsStatus, Priority, Segment, SlaState, SlaUnit, TaskStatus } from '@/shared/api/types';

/** Etiquetas en español de los códigos del backend (los códigos viajan en inglés). */

export const STATUS_LABEL: Record<PqrsStatus, string> = {
  received: 'Radicada',
  assigned: 'Asignada',
  in_progress: 'En trámite',
  on_hold: 'En espera',
  pending_approval: 'En aprobación',
  responded: 'Respondida',
  cancelled: 'Anulada',
};

export const STATUS_TONE: Record<PqrsStatus, string> = {
  received: 'bg-info/15 text-info border-info/30',
  assigned: 'bg-primary/10 text-primary border-primary/25',
  in_progress: 'bg-primary/15 text-primary border-primary/30',
  on_hold: 'bg-warning/15 text-warning border-warning/30',
  pending_approval: 'bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300',
  responded: 'bg-success/15 text-success border-success/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export const PRIORITY_TONE: Record<Priority, string> = {
  urgent: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-warning/15 text-warning border-warning/30',
  medium: 'bg-info/10 text-info border-info/25',
  low: 'bg-muted text-muted-foreground border-border',
};

export const SLA_LABEL: Record<SlaState, string> = {
  on_time: 'A tiempo',
  at_risk: 'Por vencer',
  overdue: 'Vencida',
  met: 'Cumplida',
  missed: 'Fuera de término',
};

export const SLA_TONE: Record<SlaState, string> = {
  on_time: 'bg-success/15 text-success border-success/30',
  at_risk: 'bg-warning/15 text-warning border-warning/30',
  overdue: 'bg-destructive/15 text-destructive border-destructive/30',
  met: 'bg-success/15 text-success border-success/30',
  missed: 'bg-destructive/10 text-destructive border-destructive/25',
};

export const SEGMENT_LABEL: Record<Segment, string> = {
  external: 'Cliente externo',
  internal: 'Cliente interno',
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  web: 'Portal web',
  manual: 'Ventanilla',
  email: 'Correo',
  whatsapp: 'WhatsApp',
  integration: 'Integración',
};

export const UNIT_LABEL: Record<SlaUnit, string> = {
  business_days: 'Días hábiles',
  business_hours: 'Horas hábiles',
  calendar_days: 'Días calendario',
  calendar_hours: 'Horas calendario',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Pendiente',
  in_progress: 'En curso',
  done: 'Cumplida',
  cancelled: 'Cancelada',
};

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  open: 'bg-info/15 text-info border-info/30',
  in_progress: 'bg-primary/15 text-primary border-primary/30',
  done: 'bg-success/15 text-success border-success/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

export const EVENT_LABEL: Record<string, string> = {
  created: 'Radicada',
  classified: 'Clasificación actualizada',
  assigned: 'Responsable asignado',
  status_changed: 'Cambio de estado',
  comment: 'Nota interna',
  message: 'Mensaje al solicitante',
  requester_message: 'Mensaje del solicitante',
  attachment_added: 'Adjuntos agregados',
  response_draft: 'Borrador de respuesta',
  response_submitted: 'Respuesta enviada a aprobación',
  response_returned: 'Respuesta devuelta para ajustes',
  response_sent: 'Respuesta enviada',
};

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
