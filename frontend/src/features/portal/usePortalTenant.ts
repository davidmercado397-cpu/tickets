import { useOutletContext } from 'react-router-dom';

import type { PublicTenant } from '@/shared/api/types';

/** Empresa del portal (la carga PortalLayout y la pasa por el contexto del Outlet). */
export function usePortalTenant() {
  return useOutletContext<PublicTenant>();
}
