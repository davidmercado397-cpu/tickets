import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/shared/api/errors';

/**
 * Vuelca los errores por campo de un 422 a un formulario react-hook-form.
 * `map` traduce nombres del backend (snake_case) a los del form (camelCase).
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  map: Record<string, string> = {},
): boolean {
  if (!(error instanceof ApiError) || error.fieldErrors.length === 0) return false;
  for (const fe of error.fieldErrors) {
    const field = (map[fe.field] ?? fe.field) as Path<T>;
    setError(field, { type: 'server', message: fe.message });
  }
  return true;
}
