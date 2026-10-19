import { Menu, PanelLeft, PanelLeftClose, Search } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { Breadcrumbs } from '@/app/layout/Breadcrumbs';
import { CommandPalette } from '@/app/layout/CommandPalette';
import { Sidebar } from '@/app/layout/Sidebar';
import { TopProgress } from '@/app/layout/TopProgress';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { useUiStore } from '@/shared/config/ui.store';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Sheet, SheetContent } from '@/shared/ui/sheet';
import { LoadingState } from '@/shared/ui/states/LoadingState';

export function RootLayout() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30">
      <TopProgress />

      {/* Sidebar fijo (desktop) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      {/* Drawer (móvil) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-sidebar-border p-0">
          <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Contenido */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-64',
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>

          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted sm:flex"
            >
              <Search className="h-4 w-4" />
              <span>Buscar</span>
              <kbd className="ml-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">
                Ctrl K
              </kbd>
            </button>
            <NotificationsBell />
          </div>
        </header>

        <main className="flex-1 px-3 py-4 sm:p-6">
          <div className="mx-auto w-full max-w-7xl">
            {/* Fallback mientras carga el chunk de la página (code-splitting por ruta). */}
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
