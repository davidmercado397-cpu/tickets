import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { env } from '@/shared/config/env';
import { keys } from '@/shared/hooks/queries';
import { useSessionStore } from '@/shared/session/session.store';
import { toast } from '@/shared/ui/sonner';

class FatalStreamError extends Error {}

/** Stream SSE de notificaciones (con Bearer): refresca la campana y muestra un aviso. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const token = useSessionStore((s) => s.token);
  const hasTenant = useSessionStore((s) => !!s.user?.tenant);
  const qc = useQueryClient();

  useEffect(() => {
    if (!token || !hasTenant) return;
    const ctrl = new AbortController();
    void fetchEventSource(`${env.API_BASE_URL}/notifications/stream`, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}` },
      openWhenHidden: true,
      async onopen(res) {
        const ct = res.headers.get('content-type') ?? '';
        if (res.ok && ct.includes('text/event-stream')) return;
        if (res.status >= 400 && res.status < 500) throw new FatalStreamError();
      },
      onmessage(ev) {
        if (ev.event && ev.event !== 'notification') return;
        void qc.invalidateQueries({ queryKey: keys.notifications });
        void qc.invalidateQueries({ queryKey: keys.pqrs });
        void qc.invalidateQueries({ queryKey: keys.tasks });
        try {
          const data = ev.data ? (JSON.parse(ev.data) as { title?: string; body?: string }) : null;
          if (data?.title) toast(data.title, { description: data.body ?? undefined });
        } catch {
          /* payload no JSON */
        }
      },
      onerror(err) {
        if (err instanceof FatalStreamError) throw err;
      },
    }).catch(() => undefined);
    return () => ctrl.abort();
  }, [token, hasTenant, qc]);

  return <>{children}</>;
}
