import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useTicketFilters } from '@/features/tickets/hooks/useTicketFilters';
import { useTicketsQuery } from '@/features/tickets/hooks/useTicketsQuery';
import { makeTicketColumns } from '@/features/tickets/ui/ticketColumns';
import { TicketsFilters } from '@/features/tickets/ui/TicketsFilters';
import { useCatalogMaps } from '@/shared/hooks/useCatalog';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { DataTable } from '@/shared/ui/DataTable';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { EmptyState } from '@/shared/ui/states/EmptyState';

const PAGE_SIZES = [10, 20, 50, 100];

export function TicketsListPage() {
  const { t } = useTranslation(['tickets', 'common']);
  const navigate = useNavigate();
  const { params, setPage, setPageSize } = useTicketFilters();
  const { categoryNames } = useCatalogMaps();
  const query = useTicketsQuery(params);

  const columns = useMemo(() => makeTicketColumns({ t, categoryNames }), [t, categoryNames]);

  const page = query.data?.page ?? params.page ?? 1;
  const pageSize = query.data?.pageSize ?? params.pageSize ?? 20;
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <PageHeader title={t('tickets:title')} description={`${total} ${t('common:results')}`} />

      <TicketsFilters />

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          emptyState={<EmptyState title={t('common:empty')} />}
          onRowClick={(row) => navigate(`/tickets/${row.id}`)}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{t('common:perPage')}</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <span>
              {page} {t('common:of')} {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage(page - 1)}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages || query.isFetching}
                onClick={() => setPage(page + 1)}
                aria-label="Siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
