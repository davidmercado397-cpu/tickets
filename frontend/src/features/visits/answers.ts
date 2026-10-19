import type { FormField } from '@/shared/api/types';

const YESNO: Record<string, string> = { yes: 'Sí', no: 'No', na: 'No aplica' };

/** Respuesta legible de un campo (consulta de visitas cerradas). */
export function displayAnswer(field: FormField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field.type === 'yesno') return YESNO[String(value)] ?? String(value);
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}
