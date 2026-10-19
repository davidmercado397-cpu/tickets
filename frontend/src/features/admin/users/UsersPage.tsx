import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUsers } from '@/features/admin/hooks/useUsers';
import { UserFormDialog } from '@/features/admin/users/UserFormDialog';
import type { User } from '@/shared/api/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { DataTable } from '@/shared/ui/DataTable';

export function UsersPage() {
  const { t } = useTranslation(['admin', 'common', 'auth']);
  const users = useUsers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (u: User) => {
    setEditing(u);
    setDialogOpen(true);
  };

  const columns: ColumnDef<User>[] = [
    { accessorKey: 'email', header: t('auth:email') },
    {
      accessorKey: 'displayName',
      header: t('admin:name'),
      cell: ({ row }) => row.original.displayName ?? '—',
    },
    {
      accessorKey: 'role',
      header: t('admin:role'),
      cell: ({ row }) => (
        <Badge variant={row.original.role === 'admin' ? 'default' : 'secondary'}>
          {t(`admin:roles.${row.original.role}`)}
        </Badge>
      ),
    },
    {
      accessorKey: 'areaCodes',
      header: t('admin:areaCodes'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.areaCodes.length === 0
            ? '—'
            : row.original.areaCodes.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
        </div>
      ),
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
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
            {t('common:edit')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin:users')}</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('admin:newUser')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users.data ?? []}
        isLoading={users.isLoading}
        isError={users.isError}
        onRetry={() => void users.refetch()}
      />

      <UserFormDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editing} />
    </div>
  );
}
