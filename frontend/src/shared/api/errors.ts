/** Error de campo normalizado desde un 422 (loc → nombre de campo). */
export interface FieldError {
  field: string;
  message: string;
}

/** Error uniforme de la API. El backend responde `{"detail": "...", "errors": [...]}`. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(status: number, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  static fromResponse(status: number, body: unknown): ApiError {
    const b = body as { detail?: unknown; errors?: unknown } | null;
    const fields: FieldError[] = [];
    const list = Array.isArray(b?.errors) ? b?.errors : Array.isArray(b?.detail) ? b?.detail : [];
    for (const item of list as { loc?: unknown[]; msg?: string }[]) {
      if (Array.isArray(item.loc) && item.loc.length > 0) {
        fields.push({
          field: String(item.loc[item.loc.length - 1]),
          message: String(item.msg ?? 'Valor inválido').replace(/^Value error, /, ''),
        });
      }
    }
    const message =
      typeof b?.detail === 'string'
        ? b.detail
        : status === 403
          ? 'No tienes permiso para esta acción.'
          : status === 404
            ? 'No encontrado.'
            : status >= 500
              ? 'Error del servidor. Intenta de nuevo.'
              : 'Solicitud inválida.';
    return new ApiError(status, message, fields);
  }
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}
