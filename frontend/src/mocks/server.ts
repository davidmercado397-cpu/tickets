import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/** Servidor MSW para los tests (Node). */
export const server = setupServer(...handlers);
