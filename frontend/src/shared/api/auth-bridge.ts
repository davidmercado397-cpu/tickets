/**
 * Puente de sesión entre la capa `shared/api` y la feature de auth, SIN romper la
 * regla de dependencias (shared no importa features). La feature de auth empuja el
 * token aquí y registra el handler de 401; `http.ts` solo lee de este módulo.
 */
let currentToken: string | null = null;

export function getToken(): string | null {
  return currentToken;
}

export function setToken(token: string | null): void {
  currentToken = token;
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** El AuthProvider registra qué hacer ante un 401 (limpiar sesión + redirigir). */
export function registerUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

/** Lo invoca `http.ts` cuando el backend responde 401. */
export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}
