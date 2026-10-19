import { Building2, Contact, Gauge, Tags, Ticket, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface NavSection {
  titleKey: string;
  adminOnly?: boolean;
  items: NavItem[];
}

/** Navegación del shell, agrupada. Las secciones adminOnly se filtran por rol en el layout. */
export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'nav:operation',
    items: [{ to: '/tickets', labelKey: 'tickets:title', icon: Ticket }],
  },
  {
    titleKey: 'nav:administration',
    adminOnly: true,
    items: [
      { to: '/admin/areas', labelKey: 'admin:areas', icon: Building2 },
      { to: '/admin/categories', labelKey: 'admin:categories', icon: Tags },
      { to: '/admin/users', labelKey: 'admin:users', icon: Users },
      { to: '/admin/employees', labelKey: 'admin:employees', icon: Contact },
      { to: '/admin/sla', labelKey: 'admin:sla', icon: Gauge },
    ],
  },
];
