import { RouterProvider } from 'react-router-dom';

import { router } from '@/app/router';
import { Toaster } from '@/shared/ui/sonner';
import { TooltipProvider } from '@/shared/ui/tooltip';

import { AuthProvider } from './AuthProvider';
import { I18nProvider } from './I18nProvider';
import { NotificationsProvider } from './NotificationsProvider';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';

/** Composición de providers en el orden correcto + el router de la app. */
export function AppProviders() {
  return (
    <QueryProvider>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationsProvider>
              <TooltipProvider delayDuration={200}>
                <RouterProvider router={router} />
                <Toaster />
              </TooltipProvider>
            </NotificationsProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryProvider>
  );
}
