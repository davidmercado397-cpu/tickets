import type { TicketingApi } from './port';
import { restApi } from './rest.adapter';

/**
 * Cliente de API que consume la UI. Hay UNA sola implementación (restApi): en modo
 * mock, MSW intercepta el fetch a nivel de red (el worker se arranca en main.tsx),
 * por eso no hace falta un adapter mock separado.
 */
export const api: TicketingApi = restApi;
