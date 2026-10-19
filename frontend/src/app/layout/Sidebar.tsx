import { Headset } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { NAV_SECTIONS, type NavItem } from '@/app/layout/nav';
import { UserMenu } from '@/app/layout/UserMenu';
import { useSessionUser } from '@/features/auth/hooks/useSession';
import { can } from '@/shared/config/permissions';
import { cn } from '@/shared/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

function SideNavItem({
  item,
  collapsed,
  label,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  label: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-sidebar-accent text-white shadow-sm'
            : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground',
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation(['common', 'tickets', 'admin', 'nav']);
  const user = useSessionUser();
  const isAdmin = can(user, 'manageCatalog');
  const sections = NAV_SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn('flex h-16 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-white shadow-sm">
          <Headset className="h-5 w-5" />
        </div>
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold">{t('common:appName')}</span>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {sections.map((section) => (
          <div key={section.titleKey} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">
                {t(section.titleKey)}
              </p>
            )}
            {section.items.map((item) => (
              <SideNavItem
                key={item.to}
                item={item}
                collapsed={collapsed}
                label={t(item.labelKey)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <UserMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
