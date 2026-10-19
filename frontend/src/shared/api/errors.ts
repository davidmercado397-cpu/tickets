/** Error de campo normalizado desde un 422 de FastAPI (loc → nombre de campo). */
export interface FieldError {
  field: string;
  message: string;
}

/** Error uniforme de la capa de API. Lleva el status y, si aplica, errores por campo. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(status: number, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** Construye desde el cuerpo de un 422 (HTTPValidationError de FastAPI). */
  static fromValidation(body: unknown): ApiError {
    const fields: FieldError[] = [];
    const detail = (body as { detail?: unknown } | null)?.detail;
    if (Array.isArray(detail)) {
      for (const item of detail) {
        const loc = (item as { loc?: unknown }).loc;
        const msg = (item as { msg?: unknown }).msg;
        if (Array.isArray(loc) && loc.length > 0) {
          // loc suele ser ["body", "campo"]; tomamos el último segmento como campo.
          const field = String(loc[loc.length - 1]);
          fields.push({ field, message: typeof msg === 'string' ? msg : 'Valor inválido' });
        }
      }
    }
    return new ApiError(422, 'Datos inválidos', fields);
  }
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}
