import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from '@/app/providers/AppProviders';
import { env } from '@/shared/config/env';

import '@fontsource-variable/inter';
import './index.css';

/** En modo mock, arranca el worker de MSW antes de renderizar. */
async function enableMocking(): Promise<void> {
  if (env.API_MODE !== 'mock') return;
  const { worker } = await import('@/mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

void enableMocking().then(() => {
  const root = document.getElementById('root');
  if (!root) throw new Error('No se encontró #root');
  createRoot(root).render(
    <StrictMode>
      <AppProviders />
    </StrictMode>,
  );
});
