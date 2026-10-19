import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';

import { DataTable } from '@/shared/ui/DataTable';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { LoadingState } from '@/shared/ui/states/LoadingState';

/**
 * Tabla en escritorio y tarjetas en móvil (mismo dato, dos presentaciones). Evita el scroll
 * horizontal en pantallas pequeñas.
 */
export function ResponsiveList<T>({
  data,
  columns,
  renderCard,
  isLoading,
  isError,
  onRetry,
  onRowClick,
  empty,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  renderCard: (row: T) => ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}) {
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (data.length === 0) return <>{empty ?? <EmptyState />}</>;
  return (
    <>
      <div className="hidden overflow-x-auto bg-card md:block">
        <DataTable columns={columns} data={data} onRowClick={onRowClick} />
      </div>
      <div className="space-y-2 md:hidden">
        {data.map((row, i) => (
          <div
            key={i}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className="rounded-lg border bg-card p-3 shadow-xs active:bg-muted/50"
          >
            {renderCard(row)}
          </div>
        ))}
      </div>
    </>
  );
}
