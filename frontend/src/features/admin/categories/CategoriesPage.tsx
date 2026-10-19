import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CategoryFormDialog } from '@/features/admin/categories/CategoryFormDialog';
import { useCategoryMutations } from '@/features/admin/hooks/useCategoryMutations';
import type { Category } from '@/shared/api/types';
import { useCatalogMaps } from '@/shared/hooks/useCatalog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { DataTable } from '@/shared/ui/DataTable';
import { toast } from '@/shared/ui/sonner';

export function CategoriesPage() {
  const { t } = useTranslation(['admin', 'common', 'tickets']);
  const { categories, areaNames } = useCatalogMaps();
  const { update } = useCategoryMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    setDialogOpen(true);
  };
  const toggleActive = (c: Category) =>
    update.mutate(
      { id: c.id, input: { active: !c.active } },
      { onError: () => toast.error(t('common:save')) },
    );

  const columns: ColumnDef<Category>[] = [
    { accessorKey: 'code', header: t('admin:code') },
    { accessorKey: 'name', header: t('admin:name') },
    {
      accessorKey: 'areaCode',
      header: t('tickets:area'),
      cell: ({ row }) => areaNames.get(row.original.areaCode) ?? row.original.areaCode,
    },
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
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin:categories')}</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('admin:newCategory')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={categories.data ?? []}
        isLoading={categories.isLoading}
        isError={categories.isError}
        onRetry={() => void categories.refetch()}
      />

      <CategoryFormDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} />
    </div>
  );
}
