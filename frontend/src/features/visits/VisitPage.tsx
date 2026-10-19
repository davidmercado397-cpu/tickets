import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, CloudOff, Loader2, MapPin, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { visitsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Finding, Priority, Visit } from '@/shared/api/types';
import { TaskStatusPill } from '@/shared/components/badges';
import { keys, useUserLookup } from '@/shared/hooks/queries';
import { formatDate, formatDateTime } from '@/shared/lib/date';
import { PRIORITIES, PRIORITY_LABEL } from '@/shared/lib/labels';
import { useSessionUser } from '@/shared/session/session.store';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, NativeSelect } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/sonner';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { Textarea } from '@/shared/ui/textarea';

import { displayAnswer } from './answers';
import { FieldRenderer, type PhotoSupport } from './FieldRenderer';
import { ScoreBadge } from './VisitsPage';

interface TaskDraft {
  selected: boolean;
  field_id: string;
  title: string;
  assignee_id: string;
  due_date: string;
  priority: Priority;
}

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function FillVisit({ visit, onSaved }: { visit: Visit; onSaved: (v: Visit) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useSessionUser();
  const [answers, setAnswers] = useState<Record<string, unknown>>(visit.answers ?? {});
  const [observations, setObservations] = useState(visit.observations ?? '');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [review, setReview] = useState<{ score: number | null; findings: Finding[] } | null>(null);
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const timer = useRef<number>();
  const pending = useRef<{ a: Record<string, unknown>; o: string } | null>(null);
  const people = useUserLookup('tasks.manage', null, !!review);
  const performers = useUserLookup('visits.perform', null, !!review);
  const assignees = [...(people.data ?? []), ...(performers.data ?? [])].filter((u, i, a) => a.findIndex((x) => x.id === u.id) === i);

  const flush = async () => {
    if (!pending.current) return;
    const { a, o } = pending.current;
    pending.current = null;
    setSaveState('saving');
    try {
      onSaved(await visitsApi.saveAnswers(visit.id, a, o));
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      toast.error(errorMessage(e));
    }
  };

  const queue = (a: Record<string, unknown>, o: string) => {
    pending.current = { a, o };
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 900);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setAnswer = (id: string, v: unknown) => {
    const next = { ...answers, [id]: v };
    setAnswers(next);
    queue(next, observations);
  };

  const photos: PhotoSupport = {
    upload: async (fieldId, file) => (await visitsApi.uploadPhoto(visit.id, fieldId, file)).id,
    path: (fid) => visitsApi.photoPath(visit.id, fid),
  };

  const evaluate = useMutation({
    mutationFn: async () => {
      window.clearTimeout(timer.current);
      pending.current = null;
      return visitsApi.evaluate(visit.id, answers, observations);
    },
    onSuccess: (r) => {
      setReview(r);
      setDrafts(
        r.findings.map((f) => ({
          selected: true,
          field_id: f.field_id,
          title: f.suggested_task,
          assignee_id: me?.id ?? '',
          due_date: inDays(f.priority === 'urgent' ? 1 : f.priority === 'high' ? 3 : 8),
          priority: f.priority,
        })),
      );
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const complete = useMutation({
    mutationFn: () =>
      visitsApi.complete(visit.id, {
        answers,
        observations,
        tasks: drafts.filter((d) => d.selected).map(({ selected: _s, ...t }) => ({ ...t, assignee_id: t.assignee_id || null })),
      }),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: keys.visits });
      void qc.invalidateQueries({ queryKey: keys.tasks });
      onSaved(v);
      setReview(null);
      toast.success('Visita cerrada');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => visitsApi.remove(visit.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.visits });
      navigate('/visitas');
    },
  });

  const missing = visit.fields.filter((f) => f.required && f.type !== 'section' && (answers[f.id] === undefined || answers[f.id] === null || answers[f.id] === '' || (Array.isArray(answers[f.id]) && (answers[f.id] as unknown[]).length === 0)));

  return (
    <>
      <div className="sticky top-16 z-20 -mx-3 flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saveState === 'error' ? <CloudOff className="h-3.5 w-3.5 text-destructive" /> : <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
          {saveState === 'saving' ? 'Guardando…' : saveState === 'error' ? 'Sin guardar' : 'Guardado'}
        </span>
        <span className="text-xs text-muted-foreground">{missing.length > 0 ? `Faltan ${missing.length} obligatoria(s)` : 'Completa'}</span>
      </div>
      <Card>
        <CardContent className="space-y-5 pt-6">
          {visit.fields.map((f) => (
            <FieldRenderer key={f.id} field={f} value={answers[f.id]} onChange={(v) => setAnswer(f.id, v)} photos={photos} />
          ))}
          <Field label="Observaciones generales">
            <Textarea rows={3} value={observations} onChange={(e) => { setObservations(e.target.value); queue(answers, e.target.value); }} />
          </Field>
        </CardContent>
      </Card>
      <div className="flex flex-col-reverse gap-2 pb-8 sm:flex-row sm:justify-between">
        <Button variant="ghost" className="text-destructive" onClick={() => confirm('¿Descartar esta visita en curso?') && remove.mutate()}>
          <Trash2 />
          Descartar
        </Button>
        <Button size="lg" onClick={() => evaluate.mutate()} disabled={missing.length > 0 || evaluate.isPending}>
          {evaluate.isPending ? <Loader2 className="animate-spin" /> : <ClipboardCheck />}
          Revisar y cerrar visita
        </Button>
      </div>

      <Dialog open={!!review} onOpenChange={(v) => !v && setReview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cerrar visita</DialogTitle>
          </DialogHeader>
          {review && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">Puntaje</span>
                <ScoreBadge score={review.score} />
                <span className="ml-auto text-sm">{review.findings.length} hallazgo(s)</span>
              </div>
              {review.findings.length === 0 ? (
                <Alert>
                  <AlertDescription>Sin hallazgos. ¡Buen trabajo!</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Selecciona las tareas de seguimiento que se crearán:</p>
                  {drafts.map((d, i) => {
                    const f = review.findings[i];
                    if (!f) return null;
                    const upd = (patch: Partial<TaskDraft>) => setDrafts((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <div key={d.field_id} className="space-y-2 rounded-lg border p-3">
                        <label className="flex items-start gap-2">
                          <Checkbox checked={d.selected} onCheckedChange={(v) => upd({ selected: v === true })} className="mt-0.5" />
                          <span className="text-sm">
                            <span className="flex items-center gap-1 font-medium text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {f.label}
                            </span>
                            <span className="text-muted-foreground">Respuesta: {String(Array.isArray(f.answer) ? f.answer.join(', ') : f.answer === 'no' ? 'No' : f.answer)}</span>
                          </span>
                        </label>
                        {d.selected && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input className="sm:col-span-2" value={d.title} onChange={(e) => upd({ title: e.target.value })} />
                            <NativeSelect value={d.assignee_id} onChange={(e) => upd({ assignee_id: e.target.value })}>
                              <option value="">Sin responsable</option>
                              {assignees.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.full_name}
                                </option>
                              ))}
                            </NativeSelect>
                            <div className="flex gap-2">
                              <Input type="date" value={d.due_date} onChange={(e) => upd({ due_date: e.target.value })} />
                              <NativeSelect value={d.priority} onChange={(e) => upd({ priority: e.target.value as Priority })}>
                                {PRIORITIES.map((p) => (
                                  <option key={p} value={p}>
                                    {PRIORITY_LABEL[p]}
                                  </option>
                                ))}
                              </NativeSelect>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>
              Seguir editando
            </Button>
            <Button onClick={() => complete.mutate()} disabled={complete.isPending || drafts.some((d) => d.selected && d.title.trim().length < 3)}>
              {complete.isPending && <Loader2 className="animate-spin" />}
              Cerrar visita {drafts.filter((d) => d.selected).length > 0 && `y crear ${drafts.filter((d) => d.selected).length} tarea(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ViewVisit({ visit }: { visit: Visit }) {
  const findingIds = new Set(visit.findings.map((f) => f.field_id));
  const photos: PhotoSupport = { upload: async () => '', path: (fid) => visitsApi.photoPath(visit.id, fid) };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="space-y-4 pt-6">
          {visit.fields.map((f) =>
            f.type === 'section' || f.type === 'photo' || f.type === 'signature' ? (
              <FieldRenderer key={f.id} field={f} value={visit.answers[f.id]} onChange={() => undefined} disabled photos={photos} />
            ) : (
              <div key={f.id} className={findingIds.has(f.id) ? 'rounded-md bg-destructive/5 p-2 ring-1 ring-destructive/30' : ''}>
                <p className="text-sm text-muted-foreground">{f.label}</p>
                <p className="font-medium">{displayAnswer(f, visit.answers[f.id])}</p>
              </div>
            ),
          )}
          {visit.observations && (
            <div>
              <p className="text-sm text-muted-foreground">Observaciones generales</p>
              <p className="whitespace-pre-line">{visit.observations}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Puntaje</span>
              <ScoreBadge score={visit.score} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hallazgos</span>
              <span className="font-medium">{visit.findings.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cerrada</span>
              <span className="font-medium">{formatDateTime(visit.completed_at)}</span>
            </div>
            {visit.latitude !== null && (
              <a
                className="inline-flex items-center gap-1 text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`}
              >
                <MapPin className="h-3.5 w-3.5" />
                Ver ubicación registrada
              </a>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tareas de seguimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visit.tasks.length === 0 && <p className="text-sm text-muted-foreground">Sin tareas.</p>}
            {visit.tasks.map((t) => (
              <Link key={t.id} to={`/tareas/${t.id}`} className="block space-y-1 rounded-md border p-2 hover:bg-muted/50">
                <p className="text-sm font-medium">{t.title}</p>
                <div className="flex items-center gap-2">
                  <TaskStatusPill status={t.status} />
                  <span className={t.overdue ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>{formatDate(t.due_date)}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function VisitPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const me = useSessionUser();
  const qk = [...keys.visits, 'detail', id];
  const q = useQuery({ queryKey: qk, queryFn: () => visitsApi.get(id) });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const v = q.data;
  const editable = v.status === 'draft' && v.visitor?.id === me?.id;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/visitas">
          <ArrowLeft />
          Visitas
        </Link>
      </Button>
      <div>
        <p className="text-sm text-muted-foreground">
          {v.form.name} · v{v.form_version} · {v.visitor?.name}
        </p>
        <h1 className="text-xl font-semibold sm:text-2xl">{v.site?.name}</h1>
        <p className="text-sm text-muted-foreground">{v.client?.name} · iniciada {formatDateTime(v.started_at)}</p>
      </div>
      {editable ? (
        <FillVisit visit={v} onSaved={(nv) => qc.setQueryData(qk, nv)} />
      ) : v.status === 'draft' ? (
        <Alert>
          <AlertDescription>Visita en curso por {v.visitor?.name}.</AlertDescription>
        </Alert>
      ) : (
        <ViewVisit visit={v} />
      )}
    </div>
  );
}
