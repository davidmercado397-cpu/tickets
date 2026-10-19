import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, FileText, ListPlus, Loader2, RotateCcw, Send, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { rcaApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { CauseCategory, PqrsDetail, Priority, Rca, RcaMethod, RcaParticipant, RcaStatus } from '@/shared/api/types';
import { TaskStatusPill } from '@/shared/components/badges';
import { keys, useAreas, useUserLookup } from '@/shared/hooks/queries';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatDateTime } from '@/shared/lib/date';
import { CAUSE_CATEGORY_LABEL, PRIORITIES, PRIORITY_LABEL, RCA_METHOD_LABEL } from '@/shared/lib/labels';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, NativeSelect } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/sonner';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { Textarea } from '@/shared/ui/textarea';

const STEPS: { key: RcaStatus; label: string }[] = [
  { key: 'setup', label: 'Áreas' },
  { key: 'analysis', label: 'Análisis' },
  { key: 'validation', label: 'Validación' },
  { key: 'plan', label: 'Plan de acción' },
  { key: 'closed', label: 'Cerrado' },
];

function Stepper({ status }: { status: RcaStatus }) {
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="grid grid-cols-5 gap-1">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex flex-col items-center gap-1 text-center">
          {i < current || status === 'closed' ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : (
            <Circle className={cn('h-5 w-5', i === current ? 'fill-primary text-primary' : 'text-muted-foreground/40')} />
          )}
          <span className={cn('text-[11px] leading-tight sm:text-xs', i === current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function useRcaAction<A>(pqrsId: string, fn: (a: A) => Promise<Rca>, ok: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData([...keys.pqrs, 'rca', pqrsId], data);
      void qc.invalidateQueries({ queryKey: [...keys.pqrs, 'detail', pqrsId] });
      void qc.invalidateQueries({ queryKey: [...keys.pqrs, 'list'] });
      toast.success(ok);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function SetupCard({ pqrs, rca }: { pqrs: PqrsDetail; rca: Rca }) {
  const areas = useAreas();
  const [method, setMethod] = useState<RcaMethod>(rca.method);
  const [problem, setProblem] = useState(rca.problem_statement ?? pqrs.description);
  const [selected, setSelected] = useState<string[]>(rca.participants.map((p) => p.area.id));
  const save = useRcaAction(pqrs.id, () => rcaApi.setup(pqrs.id, { method, problem_statement: problem, area_ids: selected }), 'Áreas convocadas');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{rca.status === 'setup' ? 'Convocar el análisis' : 'Ajustar áreas participantes'}</CardTitle>
        <CardDescription>Define el problema y marca las áreas que deben aportar a la causa raíz. Cada área recibe una notificación.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Planteamiento del problema">
          <Textarea rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} />
        </Field>
        <Field label="Método">
          <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as RcaMethod)}>
            {(Object.keys(RCA_METHOD_LABEL) as RcaMethod[]).map((m) => (
              <option key={m} value={m}>
                {RCA_METHOD_LABEL[m]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Áreas que intervienen">
          <div className="flex flex-wrap gap-1.5">
            {(areas.data ?? []).filter((a) => a.active).map((a) => {
              const on = selected.includes(a.id);
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium', on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate(undefined)} disabled={selected.length === 0 || problem.trim().length < 10 || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Users />}
            {rca.status === 'setup' ? 'Convocar áreas' : 'Guardar participantes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ContributionForm({ pqrsId, rca, part }: { pqrsId: string; rca: Rca; part: RcaParticipant }) {
  const [whys, setWhys] = useState<string[]>(() => {
    const base = [...part.whys];
    while (base.length < 5) base.push('');
    return base;
  });
  const [analysis, setAnalysis] = useState(part.analysis ?? '');
  const save = useRcaAction(
    pqrsId,
    () => rcaApi.contribute(pqrsId, part.area.id, { analysis, whys: whys.filter((w) => w.trim()) }),
    `Análisis de ${part.area.name} guardado`,
  );
  const fiveWhys = rca.method === 'five_whys';
  return (
    <div className="space-y-3">
      {fiveWhys &&
        whys.map((w, i) => (
          <Field key={i} label={`¿Por qué? ${i + 1}`}>
            <Input value={w} onChange={(e) => setWhys((all) => all.map((x, j) => (j === i ? e.target.value : x)))} placeholder={i === 0 ? '¿Por qué ocurrió el problema?' : '¿Por qué ocurrió lo anterior?'} />
          </Field>
        ))}
      <Field label={fiveWhys ? 'Conclusión del área' : rca.method === 'ishikawa' ? 'Causas identificadas por el área (personas, método, materiales, equipos, medición, entorno)' : 'Análisis del área'}>
        <Textarea rows={4} value={analysis} onChange={(e) => setAnalysis(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => save.mutate(undefined)} disabled={analysis.trim().length < 10 || (fiveWhys && !whys[0]?.trim()) || save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          {part.contributed_at ? 'Actualizar aporte' : 'Enviar aporte'}
        </Button>
      </div>
    </div>
  );
}

function ParticipantsCard({ pqrsId, rca }: { pqrsId: string; rca: Rca }) {
  const done = rca.participants.filter((p) => p.contributed_at).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Análisis por área · {done}/{rca.participants.length}
        </CardTitle>
        <CardDescription>Método: {RCA_METHOD_LABEL[rca.method]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rca.problem_statement && <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm">{rca.problem_statement}</p>}
        {rca.participants.map((p) => (
          <div key={p.area.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{p.area.name}</p>
              {p.contributed_at ? (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {p.contributed_by} · {formatDateTime(p.contributed_at)}
                </span>
              ) : (
                <span className="text-xs text-warning">Pendiente</span>
              )}
            </div>
            {p.can_contribute ? (
              <ContributionForm pqrsId={pqrsId} rca={rca} part={p} />
            ) : p.contributed_at ? (
              <div className="space-y-1 text-sm">
                {p.whys.map((w, i) => (
                  <p key={i}>
                    <span className="text-muted-foreground">¿Por qué? {i + 1}:</span> {w}
                  </p>
                ))}
                <p className="whitespace-pre-line">{p.analysis}</p>
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ConsolidateCard({ pqrsId, rca }: { pqrsId: string; rca: Rca }) {
  const [rootCause, setRootCause] = useState(rca.root_cause ?? '');
  const [category, setCategory] = useState<CauseCategory>(rca.cause_category ?? 'people');
  const save = useRcaAction(pqrsId, () => rcaApi.consolidate(pqrsId, { root_cause: rootCause, cause_category: category }), 'Causa raíz consolidada');
  const pending = rca.participants.filter((p) => !p.contributed_at).map((p) => p.area.name);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consolidar la causa raíz</CardTitle>
        <CardDescription>Con los aportes de las áreas, Calidad define la causa raíz del problema.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending.length > 0 && (
          <Alert>
            <AlertDescription>Faltan aportes de: {pending.join(', ')}. Si un área ya no aplica, quítala de los participantes.</AlertDescription>
          </Alert>
        )}
        <Field label="Causa raíz">
          <Textarea rows={3} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
        </Field>
        <Field label="Categoría (6M)">
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value as CauseCategory)}>
            {(Object.keys(CAUSE_CATEGORY_LABEL) as CauseCategory[]).map((c) => (
              <option key={c} value={c}>
                {CAUSE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate(undefined)} disabled={pending.length > 0 || rootCause.trim().length < 10 || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Consolidar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ValidateCard({ pqrsId }: { pqrsId: string }) {
  const [required, setRequired] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const save = useRcaAction(pqrsId, () => rcaApi.validate(pqrsId, { plan_required: required!, note }), 'Validación registrada');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Validación de Calidad</CardTitle>
        <CardDescription>¿La causa raíz exige un plan de acción para evitar que se repita?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: true, l: 'Sí, requiere plan de acción' },
            { v: false, l: 'No requiere plan' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setRequired(o.v)}
              className={cn('rounded-md border px-3 py-2.5 text-sm font-medium', required === o.v ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}
            >
              {o.l}
            </button>
          ))}
        </div>
        <Field label="Justificación">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate(undefined)} disabled={required === null || note.trim().length < 5 || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Registrar validación
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanCard({ pqrs, rca }: { pqrs: PqrsDetail; rca: Rca }) {
  const people = useUserLookup('tasks.manage', null, rca.can_manage);
  const contributors = useUserLookup('pqrs.rca_contribute', null, rca.can_manage);
  const users = [...(people.data ?? []), ...(contributors.data ?? [])].filter((u, i, a) => a.findIndex((x) => x.id === u.id) === i);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [summary, setSummary] = useState('');
  const add = useRcaAction(
    pqrs.id,
    () => rcaApi.addAction(pqrs.id, { title, description: description || null, assignee_id: assignee || null, due_date: due || null, priority }),
    'Acción agregada al plan',
  );
  const close = useRcaAction(pqrs.id, () => rcaApi.close(pqrs.id, summary), 'Plan de acción cerrado');
  useEffect(() => {
    if (add.isSuccess) {
      setTitle('');
      setDescription('');
      setDue('');
    }
  }, [add.isSuccess]);
  const editable = rca.status === 'plan' && rca.can_manage;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plan de acción</CardTitle>
        <CardDescription>Cada acción es una tarea con responsable, fecha límite, seguimiento y evidencias.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rca.actions.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay acciones.</p>}
        {rca.actions.map((a) => (
          <Link key={a.id} to={`/tareas/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5 hover:bg-muted/50">
            <div>
              <p className="text-sm font-medium">{a.title}</p>
              <p className={cn('text-xs', a.overdue ? 'text-destructive' : 'text-muted-foreground')}>
                {a.assignee ?? 'Sin responsable'} · {formatDate(a.due_date)}
              </p>
            </div>
            <TaskStatusPill status={a.status} />
          </Link>
        ))}
        {editable && (
          <>
            <div className="space-y-3 rounded-lg border border-dashed p-3">
              <p className="text-sm font-medium">Nueva acción</p>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="¿Qué se va a hacer?" />
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalle (opcional)" />
              <div className="grid gap-2 sm:grid-cols-3">
                <NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Responsable…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </NativeSelect>
                <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Fecha límite" />
                <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      Prioridad {PRIORITY_LABEL[p].toLowerCase()}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => add.mutate(undefined)} disabled={title.trim().length < 3 || add.isPending}>
                  {add.isPending ? <Loader2 className="animate-spin" /> : <ListPlus />}
                  Agregar acción
                </Button>
              </div>
            </div>
            <Field label="Resumen del plan (opcional)">
              <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <Button onClick={() => close.mutate(undefined)} disabled={rca.actions.length === 0 || close.isPending}>
                {close.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Cerrar plan y análisis
              </Button>
            </div>
          </>
        )}
        {rca.plan_summary && <p className="whitespace-pre-line text-sm">{rca.plan_summary}</p>}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ rca }: { rca: Rca }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Causa raíz</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="whitespace-pre-line">{rca.root_cause}</p>
        <p className="text-muted-foreground">
          {rca.cause_category ? CAUSE_CATEGORY_LABEL[rca.cause_category] : ''} · Consolidó {rca.consolidated_by} el {formatDateTime(rca.consolidated_at)}
        </p>
        {rca.plan_required !== null && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="font-medium">{rca.plan_required ? 'Requiere plan de acción' : 'No requiere plan de acción'}</p>
            <p className="whitespace-pre-line">{rca.validation_note}</p>
            <p className="text-xs text-muted-foreground">
              Validó {rca.validated_by} el {formatDateTime(rca.validated_at)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RcaPanel({ pqrs }: { pqrs: PqrsDetail }) {
  const q = useQuery({ queryKey: [...keys.pqrs, 'rca', pqrs.id], queryFn: () => rcaApi.get(pqrs.id) });
  const [reopenNote, setReopenNote] = useState('');
  const reopen = useRcaAction(pqrs.id, () => rcaApi.reopen(pqrs.id, reopenNote), 'Análisis reabierto');
  if (q.isLoading) return <LoadingState rows={3} />;
  if (!q.data) return null;
  const rca = q.data;
  const closedCase = ['responded', 'cancelled'].includes(pqrs.status);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Stepper status={rca.status} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {rca.status === 'closed'
                ? `Cerrado por ${rca.closed_by} el ${formatDateTime(rca.closed_at)}. La queja ya puede responderse.`
                : 'La queja no se puede responder hasta cerrar el análisis (y su plan de acción, si aplica).'}
            </p>
            {rca.status !== 'setup' && (
              <Button variant="outline" size="sm" onClick={() => rcaApi.report(pqrs.id).catch((e) => toast.error(errorMessage(e)))}>
                <FileText />
                Informe PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {rca.can_manage && !closedCase && ['setup', 'analysis'].includes(rca.status) && <SetupCard pqrs={pqrs} rca={rca} />}
      {rca.status === 'setup' && !rca.can_manage && (
        <Alert>
          <AlertDescription>Calidad aún no ha convocado a las áreas que intervienen.</AlertDescription>
        </Alert>
      )}
      {rca.status !== 'setup' && <ParticipantsCard pqrsId={pqrs.id} rca={rca} />}
      {rca.status === 'analysis' && rca.can_manage && <ConsolidateCard pqrsId={pqrs.id} rca={rca} />}
      {['validation', 'plan', 'closed'].includes(rca.status) && <SummaryCard rca={rca} />}
      {rca.status === 'validation' && rca.can_manage && <ValidateCard pqrsId={pqrs.id} />}
      {(rca.status === 'plan' || (rca.status === 'closed' && rca.plan_required)) && <PlanCard pqrs={pqrs} rca={rca} />}
      {rca.can_manage && !closedCase && ['validation', 'plan', 'closed'].includes(rca.status) && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row">
            <Input value={reopenNote} onChange={(e) => setReopenNote(e.target.value)} placeholder="Motivo para reabrir el análisis" />
            <Button variant="ghost" onClick={() => reopen.mutate(undefined)} disabled={reopenNote.trim().length < 5 || reopen.isPending}>
              <RotateCcw />
              Reabrir análisis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
