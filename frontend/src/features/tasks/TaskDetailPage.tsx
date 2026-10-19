import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, FileText, Loader2, Pencil, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { tasksApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { TaskStatus } from '@/shared/api/types';
import { PriorityPill, TaskStatusPill } from '@/shared/components/badges';
import { TaskFormDialog } from '@/shared/components/TaskFormDialog';
import { keys } from '@/shared/hooks/queries';
import { formatDate, formatDateTime } from '@/shared/lib/date';
import { TASK_STATUS_LABEL } from '@/shared/lib/labels';
import { useCan, useSessionUser } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, NativeSelect } from '@/shared/ui/field';
import { FileInput } from '@/shared/ui/file-input';
import { toast } from '@/shared/ui/sonner';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { Textarea } from '@/shared/ui/textarea';

export function TaskDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const can = useCan();
  const me = useSessionUser();
  const qk = [...keys.tasks, 'detail', id];
  const q = useQuery({ queryKey: qk, queryFn: () => tasksApi.get(id) });
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [files, setFiles] = useState<File[]>([]);
  const [edit, setEdit] = useState(false);

  const add = useMutation({
    mutationFn: (s?: TaskStatus) => tasksApi.addUpdate(id, note, s ?? (status || null), files),
    onSuccess: (t) => {
      qc.setQueryData(qk, t);
      void qc.invalidateQueries({ queryKey: keys.tasks });
      setNote('');
      setStatus('');
      setFiles([]);
      toast.success('Avance registrado');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const t = q.data;
  const canUpdate = can('tasks.manage') || t.assignee?.id === me?.id;
  const sourceLink =
    t.source_type === 'visit' && t.source_id ? `/visitas/${t.source_id}` : t.source_type === 'pqrs' && t.source_id ? `/pqrs/${t.source_id}` : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/tareas">
          <ArrowLeft />
          Tareas
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusPill status={t.status} />
            <PriorityPill priority={t.priority} />
            {t.overdue && <span className="text-xs font-medium text-destructive">Vencida</span>}
          </div>
          <h1 className="text-xl font-semibold sm:text-2xl">{t.title}</h1>
        </div>
        <div className="flex gap-2">
          {can('tasks.manage') && (
            <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
              <Pencil />
              Editar
            </Button>
          )}
          {canUpdate && !['done', 'cancelled'].includes(t.status) && (
            <Button size="sm" onClick={() => add.mutate('done')} disabled={add.isPending}>
              <CheckCircle2 />
              Marcar cumplida
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {t.description && (
            <Card>
              <CardContent className="pt-6">
                <p className="whitespace-pre-line text-sm">{t.description}</p>
              </CardContent>
            </Card>
          )}
          {canUpdate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registrar avance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Qué se hizo? ¿Qué falta?" />
                <FileInput files={files} onChange={setFiles} label="Adjuntar evidencias" accept="image/*,application/pdf,.doc,.docx,.xlsx" />
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <Field label="Cambiar estado" className="w-48">
                    <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | '')}>
                      <option value="">Sin cambio</option>
                      {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).filter((s) => s !== t.status).map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Button onClick={() => add.mutate(undefined)} disabled={add.isPending || (!note.trim() && !status && files.length === 0)}>
                    {add.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                    Guardar avance
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bitácora</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-5">
                {[...t.updates].reverse().map((u) => (
                  <li key={u.id} className="relative">
                    <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(u.at)} · {u.author_label}
                    </p>
                    {u.to_status && (
                      <p className="text-sm font-medium">
                        Estado: {TASK_STATUS_LABEL[u.to_status]}
                      </p>
                    )}
                    {u.note && <p className="whitespace-pre-line text-sm">{u.note}</p>}
                    {u.files.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {u.files.map((f) => (
                          <Button key={f.index} variant="outline" size="sm" className="h-7 text-xs" onClick={() => tasksApi.openFile(t.id, u.id, f.index)}>
                            <FileText />
                            {f.filename}
                          </Button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
        <Card className="self-start">
          <CardContent className="space-y-3 pt-6 text-sm">
            <div>
              <p className="text-muted-foreground">Responsable</p>
              <p className="font-medium">{t.assignee?.name ?? 'Sin asignar'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha límite</p>
              <p className="font-medium">{formatDate(t.due_date)}</p>
            </div>
            {(t.client || t.site) && (
              <div>
                <p className="text-muted-foreground">Cliente / sede</p>
                <p className="font-medium">{[t.client?.name, t.site?.name].filter(Boolean).join(' · ')}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Origen</p>
              {sourceLink ? (
                <Link to={sourceLink} className="font-medium text-primary hover:underline">
                  {t.source_label ?? 'Ver origen'}
                </Link>
              ) : (
                <p className="font-medium">{t.source_label ?? 'Manual'}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Creada</p>
              <p className="font-medium">
                {formatDateTime(t.created_at)} {t.created_by ? `por ${t.created_by.name}` : ''}
              </p>
            </div>
            {t.completed_at && (
              <div>
                <p className="text-muted-foreground">Cumplida</p>
                <p className="font-medium">{formatDateTime(t.completed_at)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <TaskFormDialog open={edit} onOpenChange={setEdit} task={t} onSaved={(nt) => qc.setQueryData(qk, nt)} />
    </div>
  );
}
