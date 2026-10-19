import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type DateLike = Date | string | null | undefined;

const toDate = (d: DateLike): Date | null => (d ? (typeof d === 'string' ? parseISO(d) : d) : null);

/** 03/07/2026 */
export function formatDate(d: DateLike): string {
  const v = toDate(d);
  return v ? format(v, 'dd/MM/yyyy', { locale: es }) : '—';
}

/** 03/07/2026 14:30 */
export function formatDateTime(d: DateLike): string {
  const v = toDate(d);
  return v ? format(v, 'dd/MM/yyyy HH:mm', { locale: es }) : '—';
}

/** "hace 3 horas" / "en 2 días" */
export function formatRelative(d: DateLike): string {
  const v = toDate(d);
  return v ? formatDistanceToNow(v, { locale: es, addSuffix: true }) : '—';
}

/** "octubre de 2026" desde "2026-10" */
export function formatMonth(month: string): string {
  return format(parseISO(`${month}-01`), "MMMM 'de' yyyy", { locale: es });
}

export function currentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

/** AAAA-MM-DD local para inputs type=date */
export function isoDay(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd');
}
