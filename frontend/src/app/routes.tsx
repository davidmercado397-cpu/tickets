import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import { AuthLayout } from '@/app/layout/AuthLayout';
import { NotFound } from '@/app/layout/NotFound';
import { RootLayout } from '@/app/layout/RootLayout';
import { RequireAuth } from '@/features/auth/guards/RequireAuth';
import { RequireRole } from '@/features/auth/guards/RequireRole';
import { LoginPage } from '@/features/auth/ui/LoginPage';

// Code-splitting por ruta: cada página admin/tickets es su propio chunk, descargado
// solo al navegar a ella (el login no paga el costo de bajar todo lo demás).
// Los componentes se exportan con nombre → se remapea a default para React.lazy.
const TicketsListPage = lazy(() =>
  import('@/features/tickets/ui/TicketsListPage').then((m) => ({ default: m.TicketsListPage })),
);
const TicketDetailPage = lazy(() =>
  import('@/features/tickets/ui/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage })),
);
const AreasPage = lazy(() =>
  import('@/features/admin/areas/AreasPage').then((m) => ({ default: m.AreasPage })),
);
const CategoriesPage = lazy(() =>
  import('@/features/admin/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
);
const UsersPage = lazy(() =>
  import('@/features/admin/users/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const EmployeesPage = lazy(() =>
  import('@/features/employees/ui/EmployeesPage').then((m) => ({ default: m.EmployeesPage })),
);
const SlaPage = lazy(() =>
  import('@/features/admin/sla/SlaPage').then((m) => ({ default: m.SlaPage })),
);

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { index: true, element: <Navigate to="/tickets" replace /> },
          { path: 'tickets', element: <TicketsListPage /> },
          { path: 'tickets/:id', element: <TicketDetailPage /> },
          {
            element: <RequireRole allow={['admin']} />,
            children: [
              { path: 'admin', element: <Navigate to="/admin/areas" replace /> },
              { path: 'admin/areas', element: <AreasPage /> },
              { path: 'admin/categories', element: <CategoriesPage /> },
              { path: 'admin/users', element: <UsersPage /> },
              { path: 'admin/employees', element: <EmployeesPage /> },
              { path: 'admin/sla', element: <SlaPage /> },
            ],
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];
