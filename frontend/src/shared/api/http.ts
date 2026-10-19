import { env } from '@/shared/config/env';

import { getToken, notifyUnauthorized } from './auth-bridge';
import { ApiError } from './errors';

type QueryValue = string | number | boolean | null | undefined | string[];

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON (objeto) o FormData (multipart: archivos). */
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Sin token aunque haya sesión (endpoints públicos del portal). */
  anonymous?: boolean;
}

export function toQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '' || value === false) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function request(path: string, opts: HttpOptions): Promise<Response> {
  const token = opts.anonymous ? null : getToken();
  const isForm = opts.body instanceof FormData;
  const res = await fetch(env.API_BASE_URL + path + toQueryString(opts.query), {
    method: opts.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(opts.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    signal: opts.signal,
  });
  if (res.status === 401 && token) {
    notifyUnauthorized();
    throw new ApiError(401, 'Tu sesión expiró. Ingresa de nuevo.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw ApiError.fromResponse(res.status, body);
  }
  return res;
}

/** Petición JSON. Normaliza errores del backend (`{"detail": ...}`) en `ApiError`. */
export async function http<T>(path: string, opts: HttpOptions = {}): Promise<T> {
  const res = await request(path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Descarga binaria (PDF, Excel, imágenes) con el token de sesión. */
export async function httpBlob(path: string, opts: HttpOptions = {}): Promise<Blob> {
  return (await request(path, opts)).blob();
}

/** Abre un archivo protegido en una pestaña nueva (o lo descarga si `filename`). */
export async function openFile(path: string, filename?: string, opts: HttpOptions = {}): Promise<void> {
  const blob = await httpBlob(path, opts);
  const url = URL.createObjectURL(blob);
  if (filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  } else {
    window.open(url, '_blank', 'noopener');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Construye un FormData con un campo `data` (JSON) + archivos. */
export function formWithJson(data: unknown, files: File[] = [], fileField = 'files'): FormData {
  const fd = new FormData();
  fd.append('data', JSON.stringify(data));
  files.forEach((f) => fd.append(fileField, f));
  return fd;
}
