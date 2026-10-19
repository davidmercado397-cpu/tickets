import { useMutation, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { visitsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { VisitSummary } from '@/shared/api/types';
import { keys, useClients } from '@/shared/hooks/queries';
import { cn } from '@/shared/lib/cn';
import { currentMonth, formatDateTime } from '@/shared/lib/date';
import { useCan } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, NativeSelect } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pagination } from '@/shared/ui/pagination';
import { Pill } from '@/shared/ui/pill';
import { ResponsiveList } from '@/shared/ui/responsive-list';
import { toast } from '@/shared/ui/sonner';
import { EmptyState } from '@/shared/ui/states/EmptyState';

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = score >= 85 ? 'bg-success/15 text-success border-success/30' : score >= 60 ? 'bg-warning/15 text-warning border-warning/30' : 'bg-destructive/15 text-destructive border-destructive/30';
  return <Pill tone={tone}>{score.toFixed(0)}%</Pill>;
}

function StartVisitDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const forms = useQuery({ queryKey: [...keys.visits, 'forms', 'active'], queryFn: () => visitsApi.forms(true), enabled: open });
  const clients = useClients(undefined, open);
  const [formId, setFormId] = useState('');
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const sites = clients.data?.find((c) => c.id === clientId)?.sites.filter((s) => s.active) ?? [];
  const form = formId || forms.data?.[0]?.id || '';

  const start = useMutation({
    mutationFn: () => visitsApi.start({ form_id: form, site_id: siteId, latitude: geo?.lat ?? null, longitude: geo?.lng ?? null }),
    onSuccess: (v) => navigate(`/visitas/${v.id}`),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const locate = () => {
    if (!navigator.geolocation) return toast.error('Tu dispositivo no permite ubicación.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error('No fue posible obtener la ubicación.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar visita a puesto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Formulario">
            <NativeSelect value={form} onChange={(e) => setFormId(e.target.value)}>
              {(forms.data ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Cliente">
            <NativeSelect value={clientId} onChange={(e) => { setClientId(e.target.value); setSiteId(''); }}>
              <option value="">Selecciona…</option>
              {(clients.data ?? []).filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Sede / puesto">
            <NativeSelect value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!clientId}>
              <option value="">Selecciona…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button type="button" variant="outline" onClick={locate} disabled={locating} className="w-full">
            {locating ? <Loader2 className="animate-spin" /> : <MapPin />}
            {geo ? `Ubicación registrada (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})` : 'Registrar mi ubicación (opcional)'}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => start.mutate()} disabled={!form || !siteId || start.isPending}>
            {start.isPending && <Loader2 className="animate-spin" />}
            Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VisitsPage() {
  const navigate = useNavigate();
  const can = useCan();
  const seesAll = can(['visits.manage', 'visits.view_all']);
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const tab = params.get('tab') ?? (seesAll ? 'all' : 'mine');
  const month = params.get('month') ?? currentMonth();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const f = { mine: tab === 'mine', status: status || undefined, month: status === 'draft' ? undefined : month, page, page_size: 25 };
  const list = useQuery({ queryKey: [...keys.visits, 'list', f], queryFn: () => visitsApi.list(f) });
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete('page');
    setParams(next, { replace: true });
  };

  const columns: ColumnDef<VisitSummary, unknown>[] = [
    {
      header: 'Puesto',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.site?.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.client?.name}</p>
        </div>
      ),
    },
    { header: 'Formulario', cell: ({ row }) => <span className="text-sm">{row.original.form.name}</span> },
    { header: 'Realizó', cell: ({ row }) => <span className="text-sm">{row.original.visitor?.name}</span> },
    { header: 'Fecha', cell: ({ row }) => <span className="text-sm">{formatDateTime(row.original.completed_at ?? row.original.started_at)}</span> },
    { header: 'Puntaje', cell: ({ row }) => <ScoreBadge score={row.original.score} /> },
    {
      header: 'Hallazgos',
      cell: ({ row }) => (
        <span className={cn('text-sm', row.original.findings_count > 0 && 'font-medium text-destructive')}>{row.original.findings_count}</span>
      ),
    },
    {
      header: 'Estado',
      cell: ({ row }) =>
        row.original.status === 'draft' ? <Pill tone="bg-warning/15 text-warning border-warning/30">En curso</Pill> : <Pill tone="bg-success/15 text-success border-success/30">Cerrada</Pill>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Visitas a puesto"
        description="Supervisión de los puestos de servicio por los jefes de operación."
        actions={can('visits.perform') && (
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Nueva visita
          </Button>
        )}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {seesAll && (
          <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
            {[
              { k: 'all', l: 'Todas' },
              { k: 'mine', l: 'Mis visitas' },
            ].map((t) => (
              <button key={t.k} onClick={() => set('tab', t.k)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', tab === t.k ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                {t.l}
              </button>
            ))}
          </div>
        )}
        <NativeSelect className="sm:w-44" value={status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Cerradas y en curso</option>
          <option value="completed">Cerradas</option>
          <option value="draft">En curso (borradores)</option>
        </NativeSelect>
        {status !== 'draft' && <Input type="month" className="sm:w-44" value={month} onChange={(e) => set('month', e.target.value)} />}
      </div>
      <ResponsiveList
        data={list.data?.items ?? []}
        columns={columns}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        onRowClick={(v) => navigate(`/visitas/${v.id}`)}
        empty={<EmptyState title="Sin visitas" description="Inicia una visita para registrarla aquí." />}
        renderCard={(v) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{v.site?.name}</p>
                <p className="text-xs text-muted-foreground">{v.client?.name}</p>
              </div>
              <ScoreBadge score={v.score} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(v.completed_at ?? v.started_at)} · {v.visitor?.name} · {v.status === 'draft' ? 'En curso' : `${v.findings_count} hallazgo(s)`}
            </p>
          </div>
        )}
      />
      {list.data && <Pagination page={page} pageSize={25} total={list.data.total} onPage={(p) => set('page', String(p))} />}
      <StartVisitDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
