import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { publicApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import { formatDate, formatDateTime } from '@/shared/lib/date';
import { EVENT_LABEL, STATUS_LABEL, STATUS_TONE } from '@/shared/lib/labels';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { FileInput } from '@/shared/ui/file-input';
import { Pill } from '@/shared/ui/pill';
import { toast } from '@/shared/ui/sonner';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { Textarea } from '@/shared/ui/textarea';

import { usePortalTenant } from './usePortalTenant';

export function PortalConsulta() {
  const t = usePortalTenant();
  const [params] = useSearchParams();
  const radicado = params.get('radicado') ?? '';
  const code = params.get('code') ?? '';
  const qc = useQueryClient();
  const qk = ['public-status', t.slug, radicado, code];
  const q = useQuery({ queryKey: qk, queryFn: () => publicApi.status(t.slug, radicado, code), enabled: !!radicado && !!code, retry: false });
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const reply = useMutation({
    mutationFn: () => publicApi.reply(t.slug, radicado, code, message, files),
    onSuccess: (data) => {
      qc.setQueryData(qk, data);
      setMessage('');
      setFiles([]);
      toast.success('Mensaje enviado');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/portal/${t.slug}`}>
          <ArrowLeft />
          Volver
        </Link>
      </Button>
      {q.isLoading && <LoadingState rows={4} />}
      {q.isError && <EmptyState title="No encontramos la solicitud" description="Verifica el radicado y el código de consulta." />}
      {q.data && (
        <>
          <Card>
            <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-sm text-muted-foreground">{q.data.radicado}</p>
                <CardTitle className="text-xl">{q.data.subject}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {q.data.request_type} · Radicada el {formatDate(q.data.created_at)}
                </p>
              </div>
              <Pill tone={STATUS_TONE[q.data.status]} className="self-start text-sm">
                {STATUS_LABEL[q.data.status]}
              </Pill>
            </CardHeader>
            <CardContent className="space-y-4">
              {q.data.sla_due_at && q.data.status !== 'responded' && (
                <p className="text-sm">
                  Fecha estimada de respuesta: <strong>{formatDate(q.data.sla_due_at)}</strong>
                </p>
              )}
              {q.data.attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Documentos</p>
                  <div className="flex flex-wrap gap-2">
                    {q.data.attachments.map((a) => (
                      <Button key={a.id} variant={a.source === 'response' ? 'default' : 'outline'} size="sm"
                        onClick={() => publicApi.openAttachment(t.slug, radicado, code, a).catch((e) => toast.error(errorMessage(e)))}>
                        <FileText />
                        {a.source === 'response' ? 'Descargar respuesta' : a.filename}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seguimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l pl-5">
                {q.data.events.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <p className="text-sm font-medium">
                      {e.to_status && e.kind === 'status_changed' ? STATUS_LABEL[e.to_status] : EVENT_LABEL[e.kind] ?? e.kind}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.at)}</p>
                    {e.note && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {q.data.can_reply && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Enviar información adicional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {q.data.status === 'on_hold' && (
                  <Alert>
                    <AlertDescription>Estamos esperando información tuya para continuar. Responde aquí.</AlertDescription>
                  </Alert>
                )}
                <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escribe tu mensaje…" />
                <FileInput files={files} onChange={setFiles} accept="image/*,application/pdf,.doc,.docx" />
                <div className="flex justify-end">
                  <Button onClick={() => reply.mutate()} disabled={message.trim().length < 3 || reply.isPending}>
                    {reply.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                    Enviar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
