import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Filter, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { pqrsApi, type PqrsFilters } from '@/shared/api/endpoints';
import type { PqrsStatus, PqrsSummary } from '@/shared/api/types';
import { PriorityPill, SlaPill, StatusPill } from '@/shared/components/badges';
import { keys, useAreas, useRequestTypes } from '@/shared/hooks/queries';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatRelative } from '@/shared/lib/date';
import { CHANNEL_LABEL, PRIORITIES, PRIORITY_LABEL, SEGMENT_LABEL, SLA_LABEL, STATUS_LABEL } from '@/shared/lib/labels';
import { useCan } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { NativeSelect } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pagination } from '@/shared/ui/pagination';
import { ResponsiveList } from '@/shared/ui/responsive-list';
import { EmptyState } from '@/shared/ui/states/EmptyState';

const TABS = [
  { key: 'open', label: 'Abiertas', params: { open_only: '1' } },
  { key: 'mine', label: 'Asignadas a mí', params: { mine: '1', open_only: '1' } },
  { key: 'approval', label: 'Por aprobar', params: { status: 'pending_approval' }, perm: 'pqrs.approve' },
  { key: 'unassigned', label: 'Sin clasificar', params: { status: 'received' }, perm: 'pqrs.classify' },
  { key: 'overdue', label: 'Vencidas', params: { sla_state: 'overdue' } },
  { key: 'all', label: 'Todas', params: {} },
] as const;

const FILTER_KEYS = ['segment', 'status', 'priority', 'area_id', 'request_type_id', 'channel', 'sla_state', 'client_id', 'from', 'to'] as const;

export function PqrsListPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const tab = params.get('tab') ?? 'open';
  const page = Number(params.get('page') ?? 1);
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebouncedValue(q, 350);
  const areas = useAreas();
  const types = useRequestTypes();

  const filters: PqrsFilters = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) ?? TABS[0];
    const tp = t.params as Record<string, string>;
    const f: PqrsFilters = { page, page_size: 25, q: debouncedQ || undefined };
    if (tp.open_only) f.open_only = true;
    if (tp.mine) f.mine = true;
    if (tp.status) f.status = [tp.status];
    if (tp.sla_state) f.sla_state = tp.sla_state as PqrsFilters['sla_state'];
    for (const k of FILTER_KEYS) {
      const v = params.get(k);
      if (!v) continue;
      if (k === 'status') f.status = [v];
      else (f as Record<string, unknown>)[k] = k === 'from' || k === 'to' ? `${v}T${k === 'from' ? '00:00:00' : '23:59:59'}` : v;
    }
    return f;
  }, [tab, page, debouncedQ, params]);

  const list = useQuery({ queryKey: [...keys.pqrs, 'list', filters], queryFn: () => pqrsApi.list(filters) });

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const activeFilters = FILTER_KEYS.filter((k) => params.get(k)).length;

  const columns: ColumnDef<PqrsSummary, unknown>[] = [
    {
      header: 'Radicado',
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <p className="font-mono text-xs font-semibold">{row.original.radicado}</p>
          <p className="text-xs text-muted-foreground">{formatDate(row.original.created_at)}</p>
        </div>
      ),
    },
    {
      header: 'Asunto',
      cell: ({ row }) => (
        <div className="max-w-xs">
          <p className="truncate font-medium">{row.original.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.client?.name ?? row.original.requester_name ?? '—'}
            {row.original.site ? ` · ${row.original.site.name}` : ''}
          </p>
        </div>
      ),
    },
    {
      header: 'Tipo',
      cell: ({ row }) => (
        <div className="text-xs">
          <p>{row.original.request_type?.name}</p>
          <p className="text-muted-foreground">{SEGMENT_LABEL[row.original.segment]}</p>
        </div>
      ),
    },
    { header: 'Área', cell: ({ row }) => <span className="text-sm">{row.original.area?.name ?? 'Sin área'}</span> },
    { header: 'Estado', cell: ({ row }) => <StatusPill status={row.original.status} /> },
    { header: 'Prioridad', cell: ({ row }) => <PriorityPill priority={row.original.priority} /> },
    {
      header: 'Vence',
      cell: ({ row }) => (
        <div className="space-y-1 whitespace-nowrap">
          <SlaPill state={row.original.sla_state} />
          {row.original.sla_due_at && !['responded', 'cancelled'].includes(row.original.status) && (
            <p className="text-[11px] text-muted-foreground">{formatRelative(row.original.sla_due_at)}</p>
          )}
        </div>
      ),
    },
    { header: 'Responsable', cell: ({ row }) => <span className="text-sm">{row.original.assignee?.name ?? '—'}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bandeja de PQRS"
        description="Peticiones, quejas, reclamos, sugerencias, felicitaciones y denuncias."
        actions={
          can('pqrs.create') && (
            <Button asChild>
              <Link to="/pqrs/nueva">
                <Plus />
                Radicar
              </Link>
            </Button>
          )
        }
      />

      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
          {TABS.filter((t) => !('perm' in t) || can(t.perm)).map((t) => (
            <button
              key={t.key}
              onClick={() => setParam('tab', t.key)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setParam('page', null);
            }}
            placeholder="Buscar por radicado, asunto, solicitante o documento"
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters((s) => !s)}>
          <Filter />
          Filtros {activeFilters > 0 && `(${activeFilters})`}
        </Button>
      </div>

      {showFilters && (
        <div className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
          <NativeSelect value={params.get('segment') ?? ''} onChange={(e) => setParam('segment', e.target.value)}>
            <option value="">Todos los clientes</option>
            <option value="external">{SEGMENT_LABEL.external}</option>
            <option value="internal">{SEGMENT_LABEL.internal}</option>
          </NativeSelect>
          <NativeSelect value={params.get('request_type_id') ?? ''} onChange={(e) => setParam('request_type_id', e.target.value)}>
            <option value="">Todos los tipos</option>
            {(types.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={params.get('status') ?? ''} onChange={(e) => setParam('status', e.target.value)}>
            <option value="">Todos los estados</option>
            {(Object.keys(STATUS_LABEL) as PqrsStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={params.get('area_id') ?? ''} onChange={(e) => setParam('area_id', e.target.value)}>
            <option value="">Todas las áreas</option>
            {(areas.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={params.get('priority') ?? ''} onChange={(e) => setParam('priority', e.target.value)}>
            <option value="">Todas las prioridades</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={params.get('channel') ?? ''} onChange={(e) => setParam('channel', e.target.value)}>
            <option value="">Todos los canales</option>
            {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={params.get('sla_state') ?? ''} onChange={(e) => setParam('sla_state', e.target.value)}>
            <option value="">Cualquier semáforo</option>
            {Object.entries(SLA_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
          <div className="flex gap-2">
            <Input type="date" value={params.get('from') ?? ''} onChange={(e) => setParam('from', e.target.value)} aria-label="Desde" />
            <Input type="date" value={params.get('to') ?? ''} onChange={(e) => setParam('to', e.target.value)} aria-label="Hasta" />
          </div>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              className="justify-start sm:col-span-2 lg:col-span-4"
              onClick={() => {
                const next = new URLSearchParams();
                if (params.get('tab')) next.set('tab', params.get('tab')!);
                setParams(next, { replace: true });
              }}
            >
              <X />
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      <ResponsiveList
        data={list.data?.items ?? []}
        columns={columns}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        onRowClick={(r) => navigate(`/pqrs/${r.id}`)}
        empty={<EmptyState title="No hay PQRS" description="Prueba con otra pestaña o ajusta los filtros." />}
        renderCard={(r) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-xs font-semibold">{r.radicado}</p>
              <StatusPill status={r.status} />
            </div>
            <p className="font-medium leading-snug">{r.subject}</p>
            <p className="text-xs text-muted-foreground">
              {r.request_type?.name} · {r.area?.name ?? 'Sin área'} · {r.client?.name ?? r.requester_name ?? '—'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <PriorityPill priority={r.priority} />
              <SlaPill state={r.sla_state} />
              {r.assignee && <span className="text-xs text-muted-foreground">· {r.assignee.name}</span>}
            </div>
          </div>
        )}
      />
      {list.data && (
        <Pagination page={page} pageSize={25} total={list.data.total} onPage={(p) => setParam('page', String(p))} />
      )}
    </div>
  );
}
