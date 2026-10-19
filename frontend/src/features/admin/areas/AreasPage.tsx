import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AreaFormDialog } from '@/features/admin/areas/AreaFormDialog';
import { useAreaMutations } from '@/features/admin/hooks/useAreaMutations';
import type { Area } from '@/shared/api/types';
import { useAreas } from '@/shared/hooks/useCatalog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { DataTable } from '@/shared/ui/DataTable';
import { toast } from '@/shared/ui/sonner';

export function AreasPage() {
  const { t } = useTranslation(['admin', 'common']);
  const areas = useAreas(false);
  const { update } = useAreaMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Area | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (a: Area) => {
    setEditing(a);
    setDialogOpen(true);
  };
  const toggleActive = (a: Area) =>
    update.mutate(
      { id: a.id, input: { active: !a.active } },
      { onError: () => toast.error(t('common:save')) },
    );

  const columns: ColumnDef<Area>[] = [
    { accessorKey: 'code', header: t('admin:code') },
    { accessorKey: 'name', header: t('admin:name') },
    {
      accessorKey: 'active',
      header: t('common:active'),
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'success' : 'secondary'}>
          {row.original.active ? t('common:active') : t('common:inactive')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
            {t('common:edit')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => toggleActive(row.original)}>
            {row.original.active ? t('common:disable') : t('common:enable')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin:areas')}</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('admin:newArea')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={areas.data ?? []}
        isLoading={areas.isLoading}
        isError={areas.isError}
        onRetry={() => void areas.refetch()}
      />

      <AreaFormDialog open={dialogOpen} onOpenChange={setDialogOpen} area={editing} />
    </div>
  );
}
