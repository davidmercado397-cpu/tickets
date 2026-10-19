import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Loader2, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { slaApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { BusinessCalendar, Priority, SlaPolicy, SlaUnit } from '@/shared/api/types';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatDateTime } from '@/shared/lib/date';
import { PRIORITIES, PRIORITY_LABEL, UNIT_LABEL, WEEKDAYS } from '@/shared/lib/labels';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, NativeSelect, Switch } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pill } from '@/shared/ui/pill';
import { toast } from '@/shared/ui/sonner';
import { LoadingState } from '@/shared/ui/states/LoadingState';

function PolicyRow({ policy }: { policy: SlaPolicy }) {
  const qc = useQueryClient();
  const [p, setP] = useState(policy);
  useEffect(() => setP(policy), [policy]);
  const dirty = JSON.stringify(p) !== JSON.stringify(policy);
  const sim = useQuery({ queryKey: ['sla-sim', policy.priority, policy.target_value, policy.unit], queryFn: () => slaApi.simulate(policy.priority) });
  const save = useMutation({
    mutationFn: () => slaApi.putPolicy(p.priority, { target_value: p.target_value, unit: p.unit, pause_on_hold: p.pause_on_hold, warning_percent: p.warning_percent }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sla'] });
      void qc.invalidateQueries({ queryKey: ['sla-sim'] });
      toast.success(`SLA ${PRIORITY_LABEL[p.priority]} guardado`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[120px_1fr_1fr_1fr_auto] sm:items-end">
      <div className="font-semibold">{PRIORITY_LABEL[p.priority]}</div>
      <Field label="Plazo">
        <div className="flex gap-2">
          <Input type="number" min={1} className="w-24" value={p.target_value} onChange={(e) => setP({ ...p, target_value: Number(e.target.value) })} />
          <NativeSelect value={p.unit} onChange={(e) => setP({ ...p, unit: e.target.value as SlaUnit })}>
            {(Object.keys(UNIT_LABEL) as SlaUnit[]).map((u) => (
              <option key={u} value={u}>
                {UNIT_LABEL[u]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </Field>
      <Field label="Alerta 'por vencer' al">
        <div className="flex items-center gap-2">
          <Input type="number" min={1} max={100} className="w-24" value={p.warning_percent} onChange={(e) => setP({ ...p, warning_percent: Number(e.target.value) })} />
          <span className="text-sm text-muted-foreground">% del plazo</span>
        </div>
      </Field>
      <div className="space-y-1 pb-2">
        <Switch checked={p.pause_on_hold} onChange={(v) => setP({ ...p, pause_on_hold: v })} label="Pausar en espera" />
        {sim.data && <p className="text-xs text-muted-foreground">Radicada hoy vence: {formatDateTime(sim.data.due_at)}</p>}
      </div>
      <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || p.target_value < 1 || save.isPending}>
        {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
        Guardar
      </Button>
    </div>
  );
}

function CalendarCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sla', 'calendar'], queryFn: slaApi.calendar });
  const [c, setC] = useState<BusinessCalendar | null>(null);
  useEffect(() => {
    if (q.data) setC(q.data);
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => slaApi.putCalendar(c!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sla'] });
      void qc.invalidateQueries({ queryKey: ['sla-sim'] });
      toast.success('Calendario guardado');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!c) return <LoadingState rows={2} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Calendario hábil</CardTitle>
        <CardDescription>Los días y horas hábiles se cuentan solo dentro de esta jornada, sin festivos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d, i) => {
            const on = c.workdays.includes(i);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setC({ ...c, workdays: on ? c.workdays.filter((x) => x !== i) : [...c.workdays, i].sort() })}
                className={cn('rounded-md border px-3 py-1.5 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
              >
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Inicio de jornada">
            <Input type="time" value={c.work_start} onChange={(e) => setC({ ...c, work_start: e.target.value })} />
          </Field>
          <Field label="Fin de jornada">
            <Input type="time" value={c.work_end} onChange={(e) => setC({ ...c, work_end: e.target.value })} />
          </Field>
          <Field label="Festivos nacionales">
            <NativeSelect value={c.country ?? ''} onChange={(e) => setC({ ...c, country: e.target.value || null })}>
              <option value="CO">Colombia</option>
              <option value="">No aplicar</option>
            </NativeSelect>
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending || c.workdays.length === 0}>
            <Save />
            Guardar calendario
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HolidaysCard() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const q = useQuery({ queryKey: ['sla', 'holidays', year], queryFn: () => slaApi.holidays(year) });
  const [day, setDay] = useState('');
  const [name, setName] = useState('');
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['sla'] });
    void qc.invalidateQueries({ queryKey: ['sla-sim'] });
  };
  const add = useMutation({
    mutationFn: () => slaApi.addHoliday(day, name),
    onSuccess: () => {
      refresh();
      setDay('');
      setName('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({ mutationFn: slaApi.deleteHoliday, onSuccess: refresh });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Festivos y días no hábiles</CardTitle>
          <CardDescription>Los nacionales se calculan solos; agrega los propios de la empresa.</CardDescription>
        </div>
        <NativeSelect className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </NativeSelect>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="sm:w-44" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Motivo (ej. Día de la empresa)" />
          <Button variant="outline" onClick={() => add.mutate()} disabled={!day || name.length < 2 || add.isPending}>
            <CalendarPlus />
            Agregar
          </Button>
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {(q.data ?? []).map((h) => (
            <div key={`${h.day}-${h.name}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
              <span>
                <span className="tabular-nums text-muted-foreground">{formatDate(h.day)}</span> · {h.name}
              </span>
              {h.national ? (
                <Pill>Nacional</Pill>
              ) : (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(h.id!)} aria-label="Quitar">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SlaPage() {
  const q = useQuery({ queryKey: ['sla', 'policies'], queryFn: slaApi.policies });
  const byPriority = new Map((q.data ?? []).map((p) => [p.priority, p]));
  return (
    <div className="space-y-4">
      <PageHeader
        title="SLA y calendario hábil"
        description="Tiempos de respuesta por prioridad. No bloquean la gestión: miden la oportunidad para los indicadores."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plazos por prioridad</CardTitle>
          <CardDescription>Los cambios aplican a las PQRS que se radiquen después de guardarlos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.isLoading && <LoadingState rows={4} />}
          {PRIORITIES.map((pr: Priority) => {
            const p = byPriority.get(pr);
            return p ? <PolicyRow key={pr} policy={p} /> : null;
          })}
        </CardContent>
      </Card>
      <CalendarCard />
      <HolidaysCard />
    </div>
  );
}
