import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { notificationsApi } from '@/shared/api/endpoints';
import type { AppNotification } from '@/shared/api/types';
import { keys } from '@/shared/hooks/queries';
import { cn } from '@/shared/lib/cn';
import { formatRelative } from '@/shared/lib/date';
import { useSessionUser } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Separator } from '@/shared/ui/separator';

export function NotificationsBell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const enabled = !!useSessionUser()?.tenant;
  const unread = useQuery({ queryKey: [...keys.notifications, 'count'], queryFn: notificationsApi.unread, enabled, refetchInterval: 120_000 });
  const list = useQuery({ queryKey: [...keys.notifications, 'list'], queryFn: notificationsApi.list, enabled: enabled && open });
  const refresh = () => qc.invalidateQueries({ queryKey: keys.notifications });
  const markRead = useMutation({ mutationFn: notificationsApi.read, onSuccess: refresh });
  const markAll = useMutation({ mutationFn: notificationsApi.readAll, onSuccess: refresh });
  const count = unread.data?.unread ?? 0;

  const onItem = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  if (!enabled) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-1.5rem)] max-w-sm p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-96">
          {list.data && list.data.length > 0 ? (
            <ul className="divide-y">
              {list.data.map((n) => (
                <li key={n.id}>
                  <button onClick={() => onItem(n)} className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                      <span className="block pt-0.5 text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {list.isLoading ? 'Cargando…' : 'No tienes notificaciones.'}
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
