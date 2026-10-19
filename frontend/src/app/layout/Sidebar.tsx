import { NavLink } from 'react-router-dom';

import { BrandMark } from '@/app/layout/BrandMark';
import type { NavItem } from '@/app/layout/nav';
import { useNavSections } from '@/app/layout/useNav';
import { UserMenu } from '@/app/layout/UserMenu';
import { cn } from '@/shared/lib/cn';
import { useSessionUser } from '@/shared/session/session.store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

function SideNavItem({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-white/10 text-white before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-sidebar-accent'
            : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground',
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const sections = useNavSections();
  const user = useSessionUser();
  const tenant = user?.tenant;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn('flex h-16 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <BrandMark slug={tenant?.slug} hasLogo={tenant?.has_logo} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight">{tenant?.name ?? 'Plataforma PQRS'}</p>
            <p className="truncate text-[11px] text-sidebar-muted">Gestión de PQRS y operación</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {sections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            {!collapsed && (
              <p className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <SideNavItem key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
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
