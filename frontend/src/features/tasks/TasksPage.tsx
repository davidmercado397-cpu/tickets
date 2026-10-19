import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { tasksApi, type TaskFilters } from '@/shared/api/endpoints';
import type { Task } from '@/shared/api/types';
import { PriorityPill, TaskStatusPill } from '@/shared/components/badges';
import { TaskFormDialog } from '@/shared/components/TaskFormDialog';
import { keys } from '@/shared/hooks/queries';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/date';
import { useCan } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pagination } from '@/shared/ui/pagination';
import { ResponsiveList } from '@/shared/ui/responsive-list';
import { EmptyState } from '@/shared/ui/states/EmptyState';

const SOURCE: Record<string, string> = { manual: 'Manual', visit: 'Visita', pqrs: 'PQRS', minuta: 'Minuta', integration: 'Integración' };

export function TasksPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebouncedValue(q, 300);
  const tab = params.get('tab') ?? 'mine';
  const page = Number(params.get('page') ?? 1);
  const tabs = [
    { key: 'mine', label: 'Mis tareas' },
    { key: 'open', label: 'Abiertas' },
    { key: 'overdue', label: 'Vencidas' },
    { key: 'done', label: 'Cumplidas' },
    { key: 'all', label: 'Todas' },
  ];
  const f: TaskFilters = { q: dq || undefined, page, page_size: 25 };
  if (tab === 'mine') Object.assign(f, { mine: true, open_only: true });
  if (tab === 'open') f.open_only = true;
  if (tab === 'overdue') f.overdue = true;
  if (tab === 'done') f.status = 'done';
  const list = useQuery({ queryKey: [...keys.tasks, f], queryFn: () => tasksApi.list(f) });

  const columns: ColumnDef<Task, unknown>[] = [
    {
      header: 'Tarea',
      cell: ({ row }) => (
        <div className="max-w-sm">
          <p className="truncate font-medium">{row.original.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {SOURCE[row.original.source_type] ?? row.original.source_type}
            {row.original.source_label ? ` · ${row.original.source_label}` : ''}
          </p>
        </div>
      ),
    },
    { header: 'Cliente / sede', cell: ({ row }) => <span className="text-sm">{[row.original.client?.name, row.original.site?.name].filter(Boolean).join(' · ') || '—'}</span> },
    { header: 'Responsable', cell: ({ row }) => <span className="text-sm">{row.original.assignee?.name ?? '—'}</span> },
    {
      header: 'Fecha límite',
      cell: ({ row }) => (
        <span className={cn('inline-flex items-center gap-1 text-sm', row.original.overdue && 'font-medium text-destructive')}>
          {row.original.overdue && <AlertTriangle className="h-3.5 w-3.5" />}
          {formatDate(row.original.due_date)}
        </span>
      ),
    },
    { header: 'Prioridad', cell: ({ row }) => <PriorityPill priority={row.original.priority} /> },
    { header: 'Estado', cell: ({ row }) => <TaskStatusPill status={row.original.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tareas"
        description="Seguimiento de compromisos que surgen de visitas, PQRS o de la operación."
        actions={can('tasks.manage') && (
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Nueva tarea
          </Button>
        )}
      />
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setParams({ tab: t.key }, { replace: true })}
              className={cn('whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium', tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tarea" className="pl-9" />
      </div>
      <ResponsiveList
        data={list.data?.items ?? []}
        columns={columns}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        onRowClick={(t) => navigate(`/tareas/${t.id}`)}
        empty={<EmptyState title="No hay tareas" description="Cuando se asignen tareas aparecerán aquí." />}
        renderCard={(t) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-snug">{t.title}</p>
              <TaskStatusPill status={t.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {SOURCE[t.source_type] ?? t.source_type} · {t.site?.name ?? t.client?.name ?? 'Sin cliente'} · {t.assignee?.name ?? 'Sin responsable'}
            </p>
            <div className="flex items-center gap-2">
              <PriorityPill priority={t.priority} />
              <span className={cn('text-xs', t.overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                {t.due_date ? `Vence ${formatDate(t.due_date)}` : 'Sin fecha'}
              </span>
            </div>
          </div>
        )}
      />
      {list.data && <Pagination page={page} pageSize={25} total={list.data.total} onPage={(p) => setParams({ tab, page: String(p) })} />}
      <TaskFormDialog open={open} onOpenChange={setOpen} onSaved={(t) => navigate(`/tareas/${t.id}`)} />
    </div>
  );
}
