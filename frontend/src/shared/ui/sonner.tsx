import { Toaster as Sonner, type ToasterProps } from 'sonner';

import { useThemeStore } from '@/shared/config/theme.store';

/** Toaster de la app. Toma el tema activo para el color scheme de las notificaciones. */
function Toaster(props: ToasterProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      {...props}
    />
  );
}

export { Toaster };
export { toast } from 'sonner';
