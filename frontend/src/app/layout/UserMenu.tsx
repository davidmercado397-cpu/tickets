import { ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useLogout, useSessionUser } from '@/features/auth/hooks/useSession';
import { useThemeStore } from '@/shared/config/theme.store';
import { cn } from '@/shared/lib/cn';
import { initials } from '@/shared/lib/initials';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation(['common']);
  const user = useSessionUser();
  const logout = useLogout();
  const { theme, toggle } = useThemeStore();
  const name = user?.displayName ?? user?.email ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-3 rounded-lg p-2 text-left text-sidebar-foreground transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent',
            collapsed && 'justify-center',
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-accent/20 text-sidebar-foreground">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-sidebar-muted">{user?.email}</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-muted" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => toggle()}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut />
          {t('common:logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
