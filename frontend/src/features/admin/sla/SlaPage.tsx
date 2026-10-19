import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSlaPolicies, useUpsertSla } from '@/features/admin/sla/useSla';
import type { Priority, SlaPolicy } from '@/shared/api/types';
import { PRIORITIES } from '@/shared/api/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { PageHeader } from '@/shared/ui/PageHeader';
import { toast } from '@/shared/ui/sonner';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { LoadingState } from '@/shared/ui/states/LoadingState';

function SlaRow({ priority, policy }: { priority: Priority; policy?: SlaPolicy }) {
  const { t } = useTranslation(['sla', 'tickets', 'common']);
  const upsert = useUpsertSla();
  const [resp, setResp] = useState('');
  const [reso, setReso] = useState('');

  useEffect(() => {
    setResp(policy ? String(policy.responseMinutes) : '');
    setReso(policy ? String(policy.resolutionMinutes) : '');
  }, [policy]);

  const save = () => {
    const r = Number(resp);
    const s = Number(reso);
    if (!r || !s || r <= 0 || s <= 0) {
      toast.error(t('common:save'));
      return;
    }
    upsert.mutate(
      { priority, input: { responseMinutes: r, resolutionMinutes: s } },
      { onSuccess: () => toast.success(t('sla:saved')) },
    );
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-32">
          <Label className="text-xs text-muted-foreground">{t('sla:priority')}</Label>
          <div className="pt-1.5">
            <Badge variant="outline">{t(`tickets:priorityLabels.${priority}`)}</Badge>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`resp-${priority}`} className="text-xs text-muted-foreground">
            {t('sla:responseMinutes')}
          </Label>
          <Input
            id={`resp-${priority}`}
            type="number"
            min={1}
            className="w-32"
            value={resp}
            onChange={(e) => setResp(e.target.value)}
            placeholder={t('sla:notConfigured')}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`reso-${priority}`} className="text-xs text-muted-foreground">
            {t('sla:resolutionMinutes')}
          </Label>
          <Input
            id={`reso-${priority}`}
            type="number"
            min={1}
            className="w-32"
            value={reso}
            onChange={(e) => setReso(e.target.value)}
            placeholder={t('sla:notConfigured')}
          />
        </div>
        <Button onClick={save} disabled={upsert.isPending} className="ml-auto">
          {t('common:save')}
        </Button>
      </div>
    </Card>
  );
}

export function SlaPage() {
  const { t } = useTranslation(['sla', 'common']);
  const query = useSlaPolicies();

  if (query.isLoading) return <LoadingState rows={4} />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;

  const byPriority = new Map((query.data ?? []).map((p) => [p.priority, p]));

  return (
    <div className="space-y-5">
      <PageHeader title={t('sla:title')} description={t('sla:subtitle')} />
      <div className="space-y-3">
        {PRIORITIES.map((p) => (
          <SlaRow key={p} priority={p} policy={byPriority.get(p)} />
        ))}
      </div>
    </div>
  );
}
