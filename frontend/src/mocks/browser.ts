import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

/** Worker MSW para el navegador (modo dev mock). */
export const worker = setupWorker(...handlers);
