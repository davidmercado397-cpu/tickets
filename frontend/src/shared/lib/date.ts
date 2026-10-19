import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

/** Fecha corta es-CO: 03/07/2026. */
export function formatDate(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: es });
}

/** Fecha y hora es-CO: 03/07/2026 14:30. */
export function formatDateTime(date: Date): string {
  return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
}

/** Relativo: "hace 3 horas". */
export function formatRelative(date: Date): string {
  return formatDistanceToNow(date, { locale: es, addSuffix: true });
}
