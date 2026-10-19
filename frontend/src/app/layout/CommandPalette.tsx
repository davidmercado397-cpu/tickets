import { LogOut, MoonStar } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { NAV_SECTIONS } from '@/app/layout/nav';
import { useLogout, useSessionUser } from '@/features/auth/hooks/useSession';
import { can } from '@/shared/config/permissions';
import { useThemeStore } from '@/shared/config/theme.store';
import { useUiStore } from '@/shared/config/ui.store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command';

/** Paleta de comandos (⌘K): navegación entre secciones + acciones rápidas. */
export function CommandPalette() {
  const { t } = useTranslation(['common', 'tickets', 'admin', 'nav']);
  const navigate = useNavigate();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const user = useSessionUser();
  const isAdmin = can(user, 'manageCatalog');
  const logout = useLogout();
  const toggleTheme = useThemeStore((s) => s.toggle);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const sections = NAV_SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('nav:search')} />
      <CommandList>
        <CommandEmpty>{t('common:empty')}</CommandEmpty>
        {sections.map((section) => (
          <CommandGroup key={section.titleKey} heading={t(section.titleKey)}>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.to} value={t(item.labelKey)} onSelect={() => go(item.to)}>
                  <Icon />
                  {t(item.labelKey)}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandGroup heading={t('common:theme')}>
          <CommandItem
            value="tema theme"
            onSelect={() => {
              setOpen(false);
              toggleTheme();
            }}
          >
            <MoonStar />
            {t('common:theme')}
          </CommandItem>
          <CommandItem
            value="cerrar sesion logout"
            onSelect={() => {
              setOpen(false);
              logout();
            }}
          >
            <LogOut />
            {t('common:logout')}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
