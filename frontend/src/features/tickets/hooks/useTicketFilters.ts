import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { TicketListParams, TicketStatus } from '@/shared/api/types';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Filtros del listado sincronizados con la URL (vistas compartibles + botón atrás).
 * Cambiar un filtro o el tamaño de página resetea la página a 1.
 */
export function useTicketFilters() {
  const [sp, setSp] = useSearchParams();

  const params = useMemo<TicketListParams>(
    () => ({
      status: (sp.get('status') as TicketStatus | null) || null,
      category: sp.get('category') || null,
      assignee: sp.get('assignee') || null,
      openOnly: sp.get('open_only') === '1',
      page: Number(sp.get('page') ?? '1') || 1,
      pageSize: Number(sp.get('page_size') ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE,
    }),
    [sp],
  );

  const setFilter = useCallback(
    (key: string, value: string | null) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          if (key !== 'page') next.set('page', '1');
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  const setPage = useCallback(
    (page: number) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('page', String(page));
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  const setPageSize = useCallback(
    (size: number) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('page_size', String(size));
          next.set('page', '1');
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  const reset = useCallback(() => setSp({}, { replace: true }), [setSp]);

  return { params, setFilter, setPage, setPageSize, reset };
}
