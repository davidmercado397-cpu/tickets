import {
  BarChart3,
  Building,
  Building2,
  ClipboardCheck,
  Contact,
  FileStack,
  Gauge,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  PlusCircle,
  Settings,
  ShieldCheck,
  Tags,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Se muestra si el usuario tiene AL MENOS uno de estos permisos ([] = todos). */
  perms: string[];
  superadmin?: boolean;
  end?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

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

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Inicio',
    items: [{ to: '/', label: 'Tablero', icon: LayoutDashboard, perms: ['reports.view'], end: true }],
  },
  {
    title: 'PQRS',
    items: [
      { to: '/pqrs', label: 'Bandeja de PQRS', icon: Inbox, perms: PQRS_VIEW },
      { to: '/pqrs/nueva', label: 'Radicar PQRS', icon: PlusCircle, perms: ['pqrs.create'] },
    ],
  },
  {
    title: 'Operación',
    items: [
      { to: '/visitas', label: 'Visitas a puesto', icon: ClipboardCheck, perms: ['visits.perform', 'visits.manage', 'visits.view_all'], end: true },
      { to: '/visitas/cumplimiento', label: 'Metas de visitas', icon: Target, perms: ['visits.manage', 'visits.view_all'] },
      { to: '/visitas/formularios', label: 'Formularios', icon: FileStack, perms: ['visits.manage'] },
      { to: '/tareas', label: 'Tareas', icon: ListChecks, perms: [] },
    ],
  },
  {
    title: 'Directorio',
    items: [
      { to: '/clientes', label: 'Clientes y sedes', icon: Building2, perms: ['clients.view', 'clients.manage'] },
      { to: '/empleados', label: 'Empleados', icon: Contact, perms: ['employees.view', 'employees.manage'] },
    ],
  },
  {
    title: 'Análisis',
    items: [{ to: '/reportes', label: 'Reportes', icon: BarChart3, perms: ['reports.view'] }],
  },
  {
    title: 'Configuración',
    items: [
      { to: '/config/empresa', label: 'Empresa', icon: Settings, perms: ['tenant.settings', 'integrations.manage'] },
      { to: '/config/usuarios', label: 'Usuarios', icon: Users, perms: ['users.manage'] },
      { to: '/config/roles', label: 'Roles y permisos', icon: ShieldCheck, perms: ['roles.manage'] },
      { to: '/config/areas', label: 'Áreas', icon: Building, perms: ['areas.manage'] },
      { to: '/config/catalogo', label: 'Tipos y categorías', icon: Tags, perms: ['catalog.manage'] },
      { to: '/config/sla', label: 'SLA y calendario', icon: Gauge, perms: ['sla.manage'] },
    ],
  },
  {
    title: 'Plataforma',
    items: [{ to: '/plataforma', label: 'Empresas', icon: KeyRound, perms: [], superadmin: true }],
  },
];

export const BREADCRUMB_LABELS: Record<string, string> = {
  pqrs: 'PQRS',
  nueva: 'Radicar',
  visitas: 'Visitas',
  cumplimiento: 'Metas',
  formularios: 'Formularios',
  tareas: 'Tareas',
  clientes: 'Clientes',
  empleados: 'Empleados',
  reportes: 'Reportes',
  config: 'Configuración',
  empresa: 'Empresa',
  usuarios: 'Usuarios',
  roles: 'Roles',
  areas: 'Áreas',
  catalogo: 'Catálogo',
  sla: 'SLA',
  plataforma: 'Plataforma',
  perfil: 'Mi perfil',
};
