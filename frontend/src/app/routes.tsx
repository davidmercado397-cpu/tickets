import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import { RequireAuth, RequirePerm } from '@/app/guards';
import { Home } from '@/app/Home';
import { AuthLayout } from '@/app/layout/AuthLayout';
import { NotFound } from '@/app/layout/NotFound';
import { RootLayout } from '@/app/layout/RootLayout';
import { LoginPage } from '@/features/auth/LoginPage';

// Code-splitting por página: cada módulo descarga su código solo al visitarlo.
const named = <K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

const ReportsPage = named(() => import('@/features/reports/ReportsPage'), 'ReportsPage');
const PqrsListPage = named(() => import('@/features/pqrs/PqrsListPage'), 'PqrsListPage');
const PqrsDetailPage = named(() => import('@/features/pqrs/PqrsDetailPage'), 'PqrsDetailPage');
const PqrsCreatePage = named(() => import('@/features/pqrs/PqrsCreatePage'), 'PqrsCreatePage');
const TasksPage = named(() => import('@/features/tasks/TasksPage'), 'TasksPage');
const TaskDetailPage = named(() => import('@/features/tasks/TaskDetailPage'), 'TaskDetailPage');
const VisitsPage = named(() => import('@/features/visits/VisitsPage'), 'VisitsPage');
const VisitPage = named(() => import('@/features/visits/VisitPage'), 'VisitPage');
const CompliancePage = named(() => import('@/features/visits/CompliancePage'), 'CompliancePage');
const FormsPage = named(() => import('@/features/visits/FormsPage'), 'FormsPage');
const FormBuilderPage = named(() => import('@/features/visits/FormBuilderPage'), 'FormBuilderPage');
const ClientsPage = named(() => import('@/features/clients/ClientsPage'), 'ClientsPage');
const ClientDetailPage = named(() => import('@/features/clients/ClientDetailPage'), 'ClientDetailPage');
const EmployeesPage = named(() => import('@/features/employees/EmployeesPage'), 'EmployeesPage');
const CompanyPage = named(() => import('@/features/settings/CompanyPage'), 'CompanyPage');
const UsersPage = named(() => import('@/features/settings/UsersPage'), 'UsersPage');
const RolesPage = named(() => import('@/features/settings/RolesPage'), 'RolesPage');
const AreasPage = named(() => import('@/features/settings/AreasPage'), 'AreasPage');
const CatalogPage = named(() => import('@/features/settings/CatalogPage'), 'CatalogPage');
const SlaPage = named(() => import('@/features/settings/SlaPage'), 'SlaPage');
const TenantsPage = named(() => import('@/features/platform/TenantsPage'), 'TenantsPage');
const ProfilePage = named(() => import('@/features/profile/ProfilePage'), 'ProfilePage');
const PortalLayout = named(() => import('@/features/portal/PortalLayout'), 'PortalLayout');
const PortalHome = named(() => import('@/features/portal/PortalHome'), 'PortalHome');
const PortalRadicar = named(() => import('@/features/portal/PortalRadicar'), 'PortalRadicar');
const PortalConsulta = named(() => import('@/features/portal/PortalConsulta'), 'PortalConsulta');

const PQRS_VIEW = [
  'pqrs.view_all',
  'pqrs.view_area',
  'pqrs.manage',
  'pqrs.respond',
  'pqrs.approve',
  'pqrs.create',
  'pqrs.rca_manage',
  'pqrs.rca_contribute',
];
const perm = (perms: string[], children: RouteObject[]): RouteObject => ({ element: <RequirePerm perms={perms} />, children });

export const routes: RouteObject[] = [
  { path: '/login', element: <AuthLayout />, children: [{ index: true, element: <LoginPage /> }] },
  {
    path: '/portal/:slug',
    element: <PortalLayout />,
    children: [
      { index: true, element: <PortalHome /> },
      { path: 'radicar', element: <PortalRadicar /> },
      { path: 'consulta', element: <PortalConsulta /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'perfil', element: <ProfilePage /> },
          { path: 'tareas', element: <TasksPage /> },
          { path: 'tareas/:id', element: <TaskDetailPage /> },
          perm(PQRS_VIEW, [
            { path: 'pqrs', element: <PqrsListPage /> },
            { path: 'pqrs/:id', element: <PqrsDetailPage /> },
          ]),
          perm(['pqrs.create'], [{ path: 'pqrs/nueva', element: <PqrsCreatePage /> }]),
          perm(['visits.perform', 'visits.manage', 'visits.view_all'], [
            { path: 'visitas', element: <VisitsPage /> },
            { path: 'visitas/cumplimiento', element: <CompliancePage /> },
            { path: 'visitas/:id', element: <VisitPage /> },
          ]),
          perm(['visits.manage'], [
            { path: 'visitas/formularios', element: <FormsPage /> },
            { path: 'visitas/formularios/:id', element: <FormBuilderPage /> },
          ]),
          perm(['clients.view', 'clients.manage'], [
            { path: 'clientes', element: <ClientsPage /> },
            { path: 'clientes/:id', element: <ClientDetailPage /> },
          ]),
          perm(['employees.view', 'employees.manage'], [{ path: 'empleados', element: <EmployeesPage /> }]),
          perm(['reports.view'], [{ path: 'reportes', element: <ReportsPage /> }]),
          { path: 'config', element: <Navigate to="/config/empresa" replace /> },
          perm(['tenant.settings', 'integrations.manage'], [{ path: 'config/empresa', element: <CompanyPage /> }]),
          perm(['users.manage'], [{ path: 'config/usuarios', element: <UsersPage /> }]),
          perm(['roles.manage'], [{ path: 'config/roles', element: <RolesPage /> }]),
          perm(['areas.manage'], [{ path: 'config/areas', element: <AreasPage /> }]),
          perm(['catalog.manage'], [{ path: 'config/catalogo', element: <CatalogPage /> }]),
          perm(['sla.manage'], [{ path: 'config/sla', element: <SlaPage /> }]),
          { element: <RequirePerm superadmin />, children: [{ path: 'plataforma', element: <TenantsPage /> }] },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];
