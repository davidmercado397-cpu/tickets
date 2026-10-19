import { env } from '@/shared/config/env';

import { getToken, notifyUnauthorized } from './auth-bridge';
import { ApiError } from './errors';

type QueryValue = string | number | boolean | null | undefined;

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

function toQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return res.statusText;
  }
}

/**
 * Wrapper único de fetch: arma la URL, inyecta `Authorization: Bearer`, y normaliza
 * los errores (401 → notifyUnauthorized; 422 → ApiError con errores por campo).
 * El backend no declara securityScheme, por eso el token se inyecta a mano.
 */
export async function http<T>(path: string, opts: HttpOptions = {}): Promise<T> {
  const token = getToken();
  const url = env.API_BASE_URL + path + toQueryString(opts.query);

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (res.status === 401) {
    notifyUnauthorized();
    throw new ApiError(401, 'Sesión expirada o credenciales inválidas.');
  }
  if (res.status === 422) {
    throw ApiError.fromValidation(await res.json().catch(() => null));
  }
  if (!res.ok) {
    throw new ApiError(res.status, await safeText(res));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
