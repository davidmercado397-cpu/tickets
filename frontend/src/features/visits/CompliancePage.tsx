import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { reportsApi, visitsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import { keys, useClients } from '@/shared/hooks/queries';
import { cn } from '@/shared/lib/cn';
import { currentMonth, formatMonth } from '@/shared/lib/date';
import { useCan } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, NativeSelect } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Progress } from '@/shared/ui/progress';
import { toast } from '@/shared/ui/sonner';
import { StatCard } from '@/shared/ui/stat-card';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { LoadingState } from '@/shared/ui/states/LoadingState';

function barTone(p: number) {
  return p >= 100 ? '[&>div]:bg-success' : p >= 60 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive';
}

function QuotaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const clients = useClients(undefined, open);
  const forms = useQuery({ queryKey: [...keys.visits, 'forms', 'active'], queryFn: () => visitsApi.forms(true), enabled: open });
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [n, setN] = useState(2);
  const [formId, setFormId] = useState('');
  const sites = clients.data?.find((c) => c.id === clientId)?.sites ?? [];
  const save = useMutation({
    mutationFn: () =>
      visitsApi.putQuota(siteId ? { site_id: siteId, visits_per_month: n, form_id: formId || null } : { client_id: clientId, visits_per_month: n, form_id: formId || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.visits });
      toast.success('Meta guardada');
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meta mensual de visitas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Cliente">
            <NativeSelect value={clientId} onChange={(e) => { setClientId(e.target.value); setSiteId(''); }}>
              <option value="">Selecciona…</option>
              {(clients.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Sede / puesto" hint="Si eliges una sede, la meta aplica solo a esa sede. Si no, cuenta las visitas a cualquier sede del cliente.">
            <NativeSelect value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!clientId}>
              <option value="">Todo el cliente</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Visitas por mes">
              <Input type="number" min={0} max={500} value={n} onChange={(e) => setN(Number(e.target.value))} />
            </Field>
            <Field label="Formulario sugerido">
              <NativeSelect value={formId} onChange={(e) => setFormId(e.target.value)}>
                <option value="">Cualquiera</option>
                {(forms.data ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!clientId || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CompliancePage() {
  const can = useCan();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const comp = useQuery({ queryKey: [...keys.visits, 'compliance', month], queryFn: () => visitsApi.compliance(month) });
  const quotas = useQuery({ queryKey: [...keys.visits, 'quotas'], queryFn: visitsApi.quotas });
  const del = useMutation({
    mutationFn: visitsApi.deleteQuota,
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.visits }),
  });
  const c = comp.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Metas de visitas"
        description="Cumplimiento mensual de las visitas obligatorias por cliente o puesto."
        actions={
          <div className="flex flex-wrap gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            {can('reports.export') && (
              <Button variant="outline" onClick={() => reportsApi.visitsXlsx(month)}>
                <Download />
                Excel
              </Button>
            )}
            {can('visits.manage') && (
              <Button onClick={() => setOpen(true)}>
                <Plus />
                Meta
              </Button>
            )}
          </div>
        }
      />
      {comp.isLoading ? (
        <LoadingState rows={3} />
      ) : c ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label={`Cumplimiento · ${formatMonth(month)}`} value={`${c.percent}%`} tone={c.percent >= 100 ? 'success' : c.percent >= 60 ? 'warning' : 'danger'} />
            <StatCard label="Visitas obligatorias" value={c.required} />
            <StatCard label="Visitas que cuentan" value={c.done_capped} hint="Sin contar las que exceden la meta de cada puesto" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle por cliente / puesto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {c.rows.length === 0 && <EmptyState title="Sin metas configuradas" description="Agrega metas mensuales para medir el cumplimiento." />}
              {c.rows.map((r, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {r.site ? r.site.name : r.client?.name}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{r.site ? `· ${r.client?.name}` : '· todo el cliente'}</span>
                    </span>
                    <span className={cn('font-semibold', r.percent >= 100 ? 'text-success' : r.percent >= 60 ? 'text-warning' : 'text-destructive')}>
                      {r.done}/{r.required} · {r.percent}%
                    </span>
                  </div>
                  <Progress value={r.percent} className={cn('h-2', barTone(r.percent))} />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      {can('visits.manage') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metas configuradas</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {(quotas.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No hay metas.</p>}
            {(quotas.data ?? []).map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {q.site ? <strong>{q.site.name}</strong> : <strong>{q.client?.name}</strong>}
                  <span className="text-muted-foreground"> · {q.site ? 'sede' : 'cliente'}</span>
                </span>
                <span className="flex items-center gap-2">
                  {q.visits_per_month} / mes
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => del.mutate(q.id)} aria-label="Eliminar meta">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <QuotaDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
