import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTicketFilters } from '@/features/tickets/hooks/useTicketFilters';
import { TICKET_STATUSES } from '@/shared/api/types';
import { useCategories } from '@/shared/hooks/useCatalog';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

const ALL = '__all__';

export function TicketsFilters() {
  const { t } = useTranslation(['tickets', 'common']);
  const { params, setFilter, reset } = useTicketFilters();
  const categories = useCategories(true);

  // El input de responsable se debouncea para no disparar una query por tecla.
  const [assignee, setAssignee] = useState(params.assignee ?? '');
  const debouncedAssignee = useDebouncedValue(assignee, 350);
  useEffect(() => {
    if ((debouncedAssignee || null) !== (params.assignee ?? null)) {
      setFilter('assignee', debouncedAssignee || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAssignee]);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label>{t('tickets:status')}</Label>
        <Select
          value={params.status ?? ALL}
          onValueChange={(v) => setFilter('status', v === ALL ? null : v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('common:all')}</SelectItem>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`tickets:statusLabels.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>{t('tickets:category')}</Label>
        <Select
          value={params.category ?? ALL}
          onValueChange={(v) => setFilter('category', v === ALL ? null : v)}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('common:all')}</SelectItem>
            {(categories.data ?? []).map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-assignee">{t('tickets:assignee')}</Label>
        <Input
          id="filter-assignee"
          className="w-52"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder={t('common:search')}
        />
      </div>

      <label className="flex h-10 items-center gap-2 text-sm">
        <Checkbox
          checked={params.openOnly}
          onCheckedChange={(v) => setFilter('open_only', v === true ? '1' : null)}
        />
        {t('tickets:filtersOpenOnly')}
      </label>

      <Button
        variant="ghost"
        onClick={() => {
          setAssignee('');
          reset();
        }}
      >
        {t('common:cancel')}
      </Button>
    </div>
  );
}
