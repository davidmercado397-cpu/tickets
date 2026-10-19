import { LogOut, MoonStar } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useNavSections } from '@/app/layout/useNav';
import { useThemeStore } from '@/shared/config/theme.store';
import { useUiStore } from '@/shared/config/ui.store';
import { useLogout } from '@/shared/session/useMe';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/ui/command';

/** Paleta de comandos (Ctrl/⌘ + K): navegación rápida. */
export function CommandPalette() {
  const navigate = useNavigate();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const sections = useNavSections();
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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar sección…" />
      <CommandList>
        <CommandEmpty>Sin resultados</CommandEmpty>
        {sections.map((section) => (
          <CommandGroup key={section.title} heading={section.title}>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)}>
                  <Icon />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandGroup heading="Preferencias">
          <CommandItem value="tema oscuro claro" onSelect={() => { setOpen(false); toggleTheme(); }}>
            <MoonStar />
            Cambiar tema
          </CommandItem>
          <CommandItem value="cerrar sesion salir" onSelect={() => { setOpen(false); logout(); }}>
            <LogOut />
            Cerrar sesión
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
