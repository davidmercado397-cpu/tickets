import { lazy } from 'react';

import { useHomeRedirect } from '@/app/useHomeRedirect';

const DashboardPage = lazy(() => import('@/features/reports/DashboardPage').then((m) => ({ default: m.DashboardPage })));

/** Inicio: el tablero para quien ve reportes; los demás van a su bandeja. */
export function Home() {
  return useHomeRedirect() ?? <DashboardPage />;
}
