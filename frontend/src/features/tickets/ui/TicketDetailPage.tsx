import { ArrowLeft, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { useTicketQuery } from '@/features/tickets/hooks/useTicketQuery';
import { AttachmentsList } from '@/features/tickets/ui/AttachmentsList';
import { HistoryTimeline } from '@/features/tickets/ui/HistoryTimeline';
import { SlaPanel } from '@/features/tickets/ui/SlaPanel';
import { PriorityBadge, StatusBadge } from '@/features/tickets/ui/StatusBadge';
import { TicketActions } from '@/features/tickets/ui/TicketActions';
import { formatDateTime } from '@/shared/lib/date';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { toast } from '@/shared/ui/sonner';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || '—'}</dd>
    </div>
  );
}

export function TicketDetailPage() {
  const { t } = useTranslation(['tickets', 'common']);
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const query = useTicketQuery(id);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState onRetry={() => void query.refetch()} />;

  const ticket = query.data;

  const copyRadicado = () => {
    void navigator.clipboard?.writeText(ticket.radicado);
    toast.success(t('common:copied'));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/tickets')}
          className="-ml-2 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> {t('tickets:title')}
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">{ticket.radicado}</h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={copyRadicado}
                aria-label={t('common:copy')}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            {ticket.subject && <p className="text-muted-foreground">{ticket.subject}</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Tabs defaultValue="summary" className="min-w-0">
          <TabsList>
            <TabsTrigger value="summary">{t('tickets:tabSummary')}</TabsTrigger>
            <TabsTrigger value="history">{t('tickets:tabHistory')}</TabsTrigger>
            <TabsTrigger value="attachments">{t('tickets:tabAttachments')}</TabsTrigger>
            <TabsTrigger value="sla">{t('tickets:tabSla')}</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card className="p-5">
              <div className="space-y-4">
                {ticket.description && <p className="text-sm">{ticket.description}</p>}
                <dl className="grid grid-cols-2 gap-4">
                  <Field label={t('tickets:category')} value={ticket.category.name} />
                  <Field label={t('tickets:area')} value={ticket.area.name} />
                  <Field label={t('tickets:assignee')} value={ticket.assignee} />
                  <Field label="Contacto" value={ticket.contact.name ?? ticket.contact.waId} />
                  <Field label={t('tickets:createdAt')} value={formatDateTime(ticket.createdAt)} />
                  <Field label={t('tickets:updatedAt')} value={formatDateTime(ticket.updatedAt)} />
                </dl>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="p-5">
              <HistoryTimeline history={ticket.history} />
            </Card>
          </TabsContent>

          <TabsContent value="attachments">
            <Card className="p-5">
              <AttachmentsList attachments={ticket.attachments} />
            </Card>
          </TabsContent>

          <TabsContent value="sla">
            <SlaPanel sla={ticket.sla} createdAt={ticket.createdAt} />
          </TabsContent>
        </Tabs>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <TicketActions ticket={ticket} />
        </div>
      </div>
    </div>
  );
}
