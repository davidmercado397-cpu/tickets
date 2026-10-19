import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { api } from '@/shared/api/apiClient';
import { areaKeys, categoryKeys } from '@/shared/api/queryKeys';

const CATALOG_STALE = 5 * 60_000; // el catálogo cambia poco

export function useAreas(onlyActive = false) {
  return useQuery({
    queryKey: areaKeys.list(onlyActive),
    queryFn: () => api.listAreas({ onlyActive }),
    staleTime: CATALOG_STALE,
  });
}

export function useCategories(onlyActive = false) {
  return useQuery({
    queryKey: categoryKeys.list(onlyActive),
    queryFn: () => api.listCategories({ onlyActive }),
    staleTime: CATALOG_STALE,
  });
}

/**
 * Mapas code→nombre de áreas y categorías. Los usa el listado de tickets para
 * resolver nombres (TicketSummaryOut solo trae códigos) sin N+1 ni acoplar features.
 */
export function useCatalogMaps() {
  const areas = useAreas();
  const categories = useCategories();

  const areaNames = useMemo(
    () => new Map((areas.data ?? []).map((a) => [a.code, a.name])),
    [areas.data],
  );
  const categoryNames = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.code, c.name])),
    [categories.data],
  );

  return { areaNames, categoryNames, areas, categories };
}
