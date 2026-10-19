import { createBrowserRouter } from 'react-router-dom';

import { routes } from '@/app/routes';

export const router = createBrowserRouter(routes, {
  future: { v7_relativeSplatPath: true },
});
// Nota: v7_startTransition se activa por-componente (RouterProvider) en RR6.7+.
