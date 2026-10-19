import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import type { TicketListItem } from '@/shared/api/types';
import { formatDateTime } from '@/shared/lib/date';
import { initials } from '@/shared/lib/initials';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';

import { PriorityBadge, StatusBadge } from './StatusBadge';

interface ColumnDeps {
  t: TFunction<'tickets'>;
  categoryNames: Map<string, string>;
}

/** Columnas del listado. El nombre de categoría se resuelve con el catálogo. */
export function makeTicketColumns({ t, categoryNames }: ColumnDeps): ColumnDef<TicketListItem>[] {
  return [
    {
      accessorKey: 'radicado',
      header: t('radicado'),
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{row.original.radicado}</span>
      ),
    },
    {
      accessorKey: 'subject',
      header: t('subject'),
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-[28ch] text-muted-foreground">
          {row.original.subject ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('status'),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'priority',
      header: t('priority'),
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    },
    {
      accessorKey: 'categoryCode',
      header: t('category'),
      cell: ({ row }) => (
        <span className="text-sm">
          {categoryNames.get(row.original.categoryCode) ?? row.original.categoryCode}
        </span>
      ),
    },
    {
      accessorKey: 'assignee',
      header: t('assignee'),
      cell: ({ row }) =>
        row.original.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">
                {initials(row.original.assignee)}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-[16ch] truncate text-sm">{row.original.assignee}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{t('unassigned')}</span>
        ),
    },
    {
      accessorKey: 'updatedAt',
      header: t('updatedAt'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDateTime(row.original.updatedAt)}
        </span>
      ),
    },
  ];
}
