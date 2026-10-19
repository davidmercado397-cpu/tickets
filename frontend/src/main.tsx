import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from '@/app/providers/AppProviders';

import '@fontsource-variable/inter';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró #root');
createRoot(root).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
