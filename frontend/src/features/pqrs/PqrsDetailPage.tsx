import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Copy,
  FileText,
  ListPlus,
  Loader2,
  Pause,
  Play,
  Send,
  Tags,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { pqrsApi, tasksApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { PqrsDetail } from '@/shared/api/types';
import { PriorityPill, SlaPill, StatusPill } from '@/shared/components/badges';
import { TaskFormDialog } from '@/shared/components/TaskFormDialog';
import { keys, useUserLookup } from '@/shared/hooks/queries';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatDateTime, formatRelative } from '@/shared/lib/date';
import { CHANNEL_LABEL, SEGMENT_LABEL, UNIT_LABEL } from '@/shared/lib/labels';
import { useCan } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, NativeSelect, Switch } from '@/shared/ui/field';
import { FileInput, formatBytes } from '@/shared/ui/file-input';
import { Progress } from '@/shared/ui/progress';
import { toast } from '@/shared/ui/sonner';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';

import { ClassifyDialog } from './ClassifyDialog';
import { ResponsePanel } from './ResponsePanel';
import { Timeline } from './Timeline';

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function slaProgress(p: PqrsDetail): number {
  if (!p.sla.due_at) return 0;
  const start = new Date(p.created_at).getTime();
  const end = new Date(p.sla.due_at).getTime();
  const now = p.sla.resolved_at ? new Date(p.sla.resolved_at).getTime() : Date.now();
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

/** Mutación sobre el caso: actualiza la caché del detalle y avisa. */
function usePqrsAction<A>(fn: (a: A) => Promise<PqrsDetail>, ok: string, onData: (d: PqrsDetail) => void) {
  return useMutation({
    mutationFn: fn,
    onSuccess: (d) => {
      onData(d);
      toast.success(ok);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function PqrsDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const can = useCan();
  const qk = [...keys.pqrs, 'detail', id];
  const q = useQuery({ queryKey: qk, queryFn: () => pqrsApi.get(id) });
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [statusDialog, setStatusDialog] = useState<null | 'on_hold' | 'cancelled'>(null);
  const [statusNote, setStatusNote] = useState('');
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const p = q.data;
  const assignees = useUserLookup('pqrs.manage', null, !!p && can('pqrs.assign'));
  const tasks = useQuery({
    queryKey: [...keys.tasks, 'source', id],
    queryFn: () => tasksApi.list({ source_type: 'pqrs', source_id: id, page_size: 50 }),
    enabled: !!p,
  });

  const update = (data: PqrsDetail) => {
    qc.setQueryData(qk, data);
    void qc.invalidateQueries({ queryKey: [...keys.pqrs, 'list'] });
  };
  const assign = usePqrsAction((uid: string) => pqrsApi.assign(id, uid || null), 'Responsable actualizado', update);
  const status = usePqrsAction((v: { s: string; n?: string }) => pqrsApi.status(id, v.s, v.n), 'Estado actualizado', update);
  const comment = usePqrsAction(
    async () => {
      let d = await pqrsApi.comment(id, note, isPublic);
      if (files.length) d = await pqrsApi.upload(id, files, isPublic);
      return d;
    },
    isPublic ? 'Mensaje enviado al solicitante' : 'Nota registrada',
    update,
  );
  const upload = usePqrsAction(() => pqrsApi.upload(id, files, isPublic), 'Archivos adjuntados', update);

  if (q.isLoading) return <LoadingState />;
  if (q.isError || !p) return <ErrorState onRetry={() => q.refetch()} />;

  const closed = ['responded', 'cancelled'].includes(p.status);
  const manage = can(['pqrs.manage', 'pqrs.classify', 'pqrs.approve']);
  const progress = slaProgress(p);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link to="/pqrs">
              <ArrowLeft />
              Bandeja
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => { void navigator.clipboard?.writeText(p.radicado); toast.success('Radicado copiado'); }}
            >
              {p.radicado}
              <Copy className="h-3.5 w-3.5" />
            </button>
            <StatusPill status={p.status} />
            <PriorityPill priority={p.priority} />
            <SlaPill state={p.sla.state} />
            {p.sla.paused && <span className="text-xs text-warning">⏸ Reloj en pausa</span>}
          </div>
          <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{p.subject}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('pqrs.classify') && !closed && (
            <Button variant="outline" size="sm" onClick={() => setClassifyOpen(true)}>
              <Tags />
              Clasificar
            </Button>
          )}
          {manage && !closed && ['received', 'assigned'].includes(p.status) && (
            <Button size="sm" onClick={() => status.mutate({ s: 'in_progress' })} disabled={status.isPending}>
              <Play />
              Iniciar trámite
            </Button>
          )}
          {manage && !closed && ['received', 'assigned', 'in_progress'].includes(p.status) && (
            <Button variant="outline" size="sm" onClick={() => { setStatusNote(''); setStatusDialog('on_hold'); }}>
              <Pause />
              Solicitar información
            </Button>
          )}
          {manage && p.status === 'on_hold' && (
            <Button size="sm" onClick={() => status.mutate({ s: 'in_progress' })} disabled={status.isPending}>
              <Play />
              Reanudar
            </Button>
          )}
          {can('tasks.manage') && (
            <Button variant="outline" size="sm" onClick={() => setTaskOpen(true)}>
              <ListPlus />
              Crear tarea
            </Button>
          )}
          {can(['pqrs.classify', 'pqrs.approve']) && !closed && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setStatusNote(''); setStatusDialog('cancelled'); }}>
              <Ban />
              Anular
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Tabs defaultValue={p.status === 'pending_approval' ? 'respuesta' : 'detalle'}>
            <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="detalle">Detalle</TabsTrigger>
              <TabsTrigger value="seguimiento">Seguimiento ({p.events.length})</TabsTrigger>
              <TabsTrigger value="respuesta">Respuesta</TabsTrigger>
            </TabsList>

            <TabsContent value="detalle" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Descripción</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed">{p.description}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Adjuntos ({p.attachments.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {p.attachments.length === 0 && <p className="text-sm text-muted-foreground">Sin adjuntos.</p>}
                  {p.attachments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => pqrsApi.openAttachment(p.id, a).catch((e) => toast.error(errorMessage(e)))}
                      className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {a.source === 'requester' ? 'Solicitante' : a.source === 'response' ? 'Respuesta' : 'Interno'} · {formatBytes(a.size)}
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
              {!closed && manage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Agregar nota o mensaje</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={isPublic ? 'Mensaje que recibirá el solicitante por correo y en el portal' : 'Nota interna (no la ve el solicitante)'} />
                    <FileInput files={files} onChange={setFiles} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Switch checked={isPublic} onChange={setIsPublic} label="Enviar al solicitante" />
                      <div className="flex gap-2">
                        {files.length > 0 && !note.trim() && (
                          <Button variant="outline" onClick={() => upload.mutate(undefined, { onSuccess: () => setFiles([]) })} disabled={upload.isPending}>
                            Solo adjuntar
                          </Button>
                        )}
                        <Button
                          onClick={() => comment.mutate(undefined, { onSuccess: () => { setNote(''); setFiles([]); } })}
                          disabled={!note.trim() || comment.isPending}
                        >
                          {comment.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                          {isPublic ? 'Enviar mensaje' : 'Guardar nota'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="seguimiento">
              <Card>
                <CardContent className="pt-6">
                  <Timeline events={p.events} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="respuesta">
              <ResponsePanel pqrs={p} onChange={update} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tiempo de respuesta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Vence</span>
                <span className="font-semibold">{formatDateTime(p.sla.due_at)}</span>
              </div>
              <Progress
                value={progress}
                className={cn('h-2', p.sla.state === 'overdue' || p.sla.state === 'missed' ? '[&>div]:bg-destructive' : p.sla.state === 'at_risk' ? '[&>div]:bg-warning' : '[&>div]:bg-success')}
              />
              <p className="text-xs text-muted-foreground">
                {p.sla.policy.target_value} {p.sla.policy.unit ? UNIT_LABEL[p.sla.policy.unit].toLowerCase() : ''}
                {p.sla.policy.pauses ? ` · ${p.sla.policy.pauses} pausa(s)` : ''}
                {!closed && p.sla.due_at ? ` · ${formatRelative(p.sla.due_at)}` : ''}
              </p>
              {p.sla.resolved_at && <InfoRow label="Respondida">{formatDateTime(p.sla.resolved_at)}</InfoRow>}
              {p.sla.first_response_at && <InfoRow label="Primera gestión">{formatDateTime(p.sla.first_response_at)}</InfoRow>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Responsable</CardTitle>
            </CardHeader>
            <CardContent>
              {can('pqrs.assign') && !closed ? (
                <NativeSelect value={p.assignee?.id ?? ''} onChange={(e) => assign.mutate(e.target.value)} disabled={assign.isPending}>
                  <option value="">Sin asignar</option>
                  {(assignees.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <p className="flex items-center gap-2 text-sm">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  {p.assignee?.name ?? 'Sin asignar'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Información</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow label="Cliente">{SEGMENT_LABEL[p.segment]}</InfoRow>
              <InfoRow label="Tipo">{p.request_type?.name ?? '—'}</InfoRow>
              <InfoRow label="Categoría">{p.category?.name ?? 'Sin clasificar'}</InfoRow>
              {p.subcategory && <InfoRow label="Subcategoría">{p.subcategory.name}</InfoRow>}
              <InfoRow label="Área">{p.area?.name ?? 'Sin área'}</InfoRow>
              <InfoRow label="Canal">{CHANNEL_LABEL[p.channel]}</InfoRow>
              <InfoRow label="Radicada">{formatDateTime(p.created_at)}</InfoRow>
              {p.created_by && <InfoRow label="Radicó">{p.created_by.name}</InfoRow>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Solicitante</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {p.is_anonymous && <InfoRow label="Tipo">Anónimo</InfoRow>}
              {p.requester.name && <InfoRow label="Nombre">{p.requester.name}</InfoRow>}
              {p.requester.document && <InfoRow label="Documento">{`${p.requester.doc_type ?? ''} ${p.requester.document}`}</InfoRow>}
              {p.requester.email && <InfoRow label="Correo">{p.requester.email}</InfoRow>}
              {p.requester.phone && <InfoRow label="Teléfono">{p.requester.phone}</InfoRow>}
              {p.client && <InfoRow label="Empresa">{p.client.name}</InfoRow>}
              {!p.client && p.requester.company && <InfoRow label="Empresa">{p.requester.company}</InfoRow>}
              {p.site && <InfoRow label="Sede">{p.site.name}</InfoRow>}
              {p.employee && <InfoRow label="Empleado">{p.employee.name}</InfoRow>}
              <InfoRow label="Código portal">
                <span className="font-mono">{p.public_code}</span>
              </InfoRow>
              {p.consent_at && <InfoRow label="Habeas data">{formatDate(p.consent_at)}</InfoRow>}
            </CardContent>
          </Card>

          {(tasks.data?.items.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tareas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {tasks.data!.items.map((t) => (
                  <Link key={t.id} to={`/tareas/${t.id}`} className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    {t.title} <span className="text-xs text-muted-foreground">· {t.assignee?.name ?? 'sin responsable'}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <ClassifyDialog pqrs={p} open={classifyOpen} onOpenChange={setClassifyOpen} onSaved={update} />
      <TaskFormDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        defaults={{
          title: `Seguimiento ${p.radicado}`,
          source_type: 'pqrs',
          source_id: p.id,
          source_label: `PQRS ${p.radicado}`,
          client_id: p.client?.id,
          site_id: p.site?.id,
          priority: p.priority,
        }}
        onSaved={() => void tasks.refetch()}
      />
      <Dialog open={!!statusDialog} onOpenChange={(v) => !v && setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusDialog === 'on_hold' ? 'Solicitar información al solicitante' : 'Anular PQRS'}</DialogTitle>
          </DialogHeader>
          <Field
            label={statusDialog === 'on_hold' ? '¿Qué información necesitas?' : 'Motivo de la anulación'}
            hint={statusDialog === 'on_hold' ? 'Se envía al solicitante; el reloj del SLA se pausa hasta que responda.' : 'Queda en la trazabilidad y se informa al solicitante.'}
          >
            <Textarea rows={4} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant={statusDialog === 'cancelled' ? 'destructive' : 'default'}
              disabled={!statusNote.trim() || status.isPending}
              onClick={() => status.mutate({ s: statusDialog!, n: statusNote }, { onSuccess: () => setStatusDialog(null) })}
            >
              {status.isPending && <Loader2 className="animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
