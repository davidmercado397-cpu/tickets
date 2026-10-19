import { ChevronsUpDown, LogOut, Moon, Sun, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useThemeStore } from '@/shared/config/theme.store';
import { cn } from '@/shared/lib/cn';
import { initials } from '@/shared/lib/initials';
import { useSessionUser } from '@/shared/session/session.store';
import { useLogout } from '@/shared/session/useMe';
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
  const user = useSessionUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const { theme, toggle } = useThemeStore();
  const name = user?.full_name ?? user?.email ?? '';
  const roles = user?.is_superadmin ? 'Superadministrador' : user?.roles.map((r) => r.name).join(', ');

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
            <AvatarFallback className="bg-white/15 text-sidebar-foreground">{initials(name)}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-sidebar-muted">{roles}</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-muted" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/perfil')}>
          <UserCircle />
          Mi perfil y firma
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggle()}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
