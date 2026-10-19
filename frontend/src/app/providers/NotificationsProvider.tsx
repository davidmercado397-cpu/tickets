import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { useSessionStore } from '@/features/auth/model/session.store';
import { notificationKeys } from '@/shared/api/queryKeys';
import { env } from '@/shared/config/env';
import { toast } from '@/shared/ui/sonner';

class FatalStreamError extends Error {}

/**
 * Suscribe el stream SSE de notificaciones (solo en modo real; en mock no hay stream).
 * Usa fetch-event-source para poder mandar el Bearer (EventSource nativo no permite headers).
 * Al recibir un evento invalida las queries de notificaciones y muestra un toast.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const token = useSessionStore((s) => s.token);
  const qc = useQueryClient();

  useEffect(() => {
    if (env.API_MODE !== 'rest' || !token) return;
    const ctrl = new AbortController();

    void fetchEventSource(`${env.API_BASE_URL}/notifications/stream`, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}` },
      openWhenHidden: true,
      async onopen(res) {
        const ct = res.headers.get('content-type') ?? '';
        if (res.ok && ct.includes('text/event-stream')) return;
        // 4xx (p.ej. 401 token vencido) → fatal, no reintentar.
        if (res.status >= 400 && res.status < 500) throw new FatalStreamError();
        // 5xx / otros → deja que reintente.
      },
      onmessage(ev) {
        if (ev.event && ev.event !== 'notification') return;
        void qc.invalidateQueries({ queryKey: notificationKeys.all });
        try {
          const data = ev.data ? (JSON.parse(ev.data) as { title?: string }) : null;
          if (data?.title) toast(data.title);
        } catch {
          /* payload no-JSON: solo refrescamos */
        }
      },
      onerror(err) {
        if (err instanceof FatalStreamError) throw err; // corta reintentos
        // resto: retorno undefined → reintenta con backoff
      },
    }).catch(() => {
      /* abort o error fatal: fin del stream hasta que cambie el token */
    });

    return () => ctrl.abort();
  }, [token, qc]);

  return <>{children}</>;
}
