import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Eye, FileText, Loader2, Save, Send, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { pqrsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { PqrsDetail } from '@/shared/api/types';
import { formatDateTime } from '@/shared/lib/date';
import { useCan } from '@/shared/session/session.store';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { toast } from '@/shared/ui/sonner';
import { Textarea } from '@/shared/ui/textarea';

const TEMPLATE = (p: PqrsDetail) =>
  `Respetado(a) ${p.requester.name || 'señor(a)'}:\n\nEn atención a su ${p.request_type?.name?.toLowerCase() ?? 'solicitud'} radicada con el número ${p.radicado}, nos permitimos informarle que...\n\nQuedamos atentos a cualquier inquietud adicional.`;

/** Proyección de la respuesta formal y su aprobación (o devolución). */
export function ResponsePanel({ pqrs, onChange }: { pqrs: PqrsDetail; onChange: (p: PqrsDetail) => void }) {
  const can = useCan();
  const pending = [...pqrs.responses].reverse().find((r) => ['draft', 'pending_approval', 'returned'].includes(r.status));
  const sent = pqrs.responses.filter((r) => r.status === 'sent');
  const [body, setBody] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const closed = ['responded', 'cancelled'].includes(pqrs.status);
  const awaiting = pending?.status === 'pending_approval';

  useEffect(() => {
    setBody(pending?.body ?? (closed ? '' : TEMPLATE(pqrs)));
  }, [pending?.id, pending?.body, closed, pqrs]);

  const save = useMutation({
    mutationFn: (action: 'draft' | 'submit' | 'send') => pqrsApi.saveResponse(pqrs.id, body, action),
    onSuccess: (p, action) => {
      onChange(p);
      toast.success(action === 'draft' ? 'Borrador guardado' : action === 'submit' ? 'Enviada a aprobación' : 'Respuesta enviada');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const approve = useMutation({
    mutationFn: () => pqrsApi.approve(pqrs.id, pending!.id, reviewNote || undefined, body !== pending?.body ? body : undefined),
    onSuccess: (p) => {
      onChange(p);
      toast.success('Respuesta aprobada y enviada al solicitante');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const giveBack = useMutation({
    mutationFn: () => pqrsApi.returnResponse(pqrs.id, pending!.id, reviewNote),
    onSuccess: (p) => {
      onChange(p);
      setReviewNote('');
      toast.success('Respuesta devuelta al gestor');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const preview = useMutation({ mutationFn: () => pqrsApi.preview(pqrs.id, body), onError: (e) => toast.error(errorMessage(e)) });
  const busy = save.isPending || approve.isPending || giveBack.isPending;
  const canWrite = can(['pqrs.respond', 'pqrs.approve']) && !closed && (!awaiting || can('pqrs.approve'));

  return (
    <div className="space-y-4">
      {sent.map((r) => (
        <Card key={r.id} className="border-success/40">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Respuesta enviada
            </CardTitle>
            <span className="text-xs text-muted-foreground">{formatDateTime(r.sent_at)}</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-line text-sm">{r.body}</p>
            <p className="text-xs text-muted-foreground">
              Proyectó: {r.author_name ?? '—'} · Aprobó: {r.reviewer_name ?? '—'}
              {r.sent_to ? ` · Enviada a ${r.sent_to}` : ' · Sin correo del solicitante (disponible en el portal)'}
            </p>
            {(() => {
              const pdf = pqrs.attachments.find((a) => a.source === 'response');
              return pdf ? (
                <Button variant="outline" size="sm" onClick={() => pqrsApi.openAttachment(pqrs.id, pdf)}>
                  <FileText />
                  Ver carta PDF
                </Button>
              ) : null;
            })()}
          </CardContent>
        </Card>
      ))}

      {!closed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{awaiting ? 'Respuesta en aprobación' : 'Proyectar respuesta'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending?.status === 'returned' && pending.review_note && (
              <Alert variant="destructive">
                <AlertTitle>Devuelta para ajustes</AlertTitle>
                <AlertDescription>{pending.review_note}</AlertDescription>
              </Alert>
            )}
            {awaiting && (
              <Alert>
                <AlertDescription>
                  Proyectada por {pending?.author_name ?? '—'} el {formatDateTime(pending?.submitted_at)}.
                  {can('pqrs.approve') ? ' Revisa, ajusta si es necesario y aprueba.' : ' Pendiente de revisión del aprobador.'}
                </AlertDescription>
              </Alert>
            )}
            <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} disabled={!canWrite} className="font-[inherit] leading-relaxed" />
            <p className="text-xs text-muted-foreground">
              Separa los párrafos con una línea en blanco. La carta incluye membrete, datos del radicado y la firma de quien aprueba.
            </p>
            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => preview.mutate()} disabled={body.length < 10 || preview.isPending}>
                  {preview.isPending ? <Loader2 className="animate-spin" /> : <Eye />}
                  Vista previa PDF
                </Button>
                {!awaiting && (
                  <>
                    <Button variant="outline" onClick={() => save.mutate('draft')} disabled={busy || body.length < 10}>
                      <Save />
                      Guardar borrador
                    </Button>
                    <Button onClick={() => save.mutate('submit')} disabled={busy || body.length < 10}>
                      <Send />
                      Enviar a aprobación
                    </Button>
                    {can('pqrs.approve') && (
                      <Button variant="secondary" onClick={() => save.mutate('send')} disabled={busy || body.length < 10}>
                        <CheckCircle2 />
                        Aprobar y enviar
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
            {awaiting && can('pqrs.approve') && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Textarea rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Observaciones (obligatorias para devolver)" />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => approve.mutate()} disabled={busy}>
                    {approve.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                    Aprobar y enviar
                  </Button>
                  <Button variant="outline" onClick={() => giveBack.mutate()} disabled={busy || !reviewNote.trim()}>
                    <Undo2 />
                    Devolver
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
