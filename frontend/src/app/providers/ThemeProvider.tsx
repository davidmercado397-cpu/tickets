import { useEffect, type ReactNode } from 'react';

import { useThemeStore } from '@/shared/config/theme.store';

/** Aplica la clase de tema al <html>. El estado vive en el store compartido. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return <>{children}</>;
}
