import type { ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEmployees } from '@/features/employees/hooks/useEmployees';
import { EmployeeFormDialog } from '@/features/employees/ui/EmployeeFormDialog';
import type { Employee } from '@/shared/api/types';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { DataTable } from '@/shared/ui/DataTable';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';

const PAGE_SIZE = 20;

export function EmployeesPage() {
  const { t } = useTranslation(['employees', 'common']);
  const [q, setQ] = useState('');
  const debounced = useDebouncedValue(q, 350);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>();

  useEffect(() => setPage(1), [debounced]);

  const query = useEmployees({ q: debounced || null, page, pageSize: PAGE_SIZE });
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (e: Employee) => {
    setEditing(e);
    setDialogOpen(true);
  };

  const columns: ColumnDef<Employee>[] = useMemo(
    () => [
      { accessorKey: 'document', header: t('employees:document') },
      { accessorKey: 'fullName', header: t('employees:fullName') },
      {
        accessorKey: 'position',
        header: t('employees:position'),
        cell: ({ row }) => row.original.position ?? '—',
      },
      {
        accessorKey: 'contractType',
        header: t('employees:contractType'),
        cell: ({ row }) => row.original.contractType ?? '—',
      },
      {
        accessorKey: 'status',
        header: t('employees:status'),
        cell: ({ row }) =>
          row.original.status ? <Badge variant="secondary">{row.original.status}</Badge> : '—',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
              {t('common:edit')}
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('employees:title')}
        description={`${total} ${t('common:results')}`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t('employees:newEmployee')}
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('employees:searchPlaceholder')}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
        />
        <div className="flex items-center justify-end gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            {page} {t('common:of')} {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages || query.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <EmployeeFormDialog open={dialogOpen} onOpenChange={setDialogOpen} employee={editing} />
    </div>
  );
}
