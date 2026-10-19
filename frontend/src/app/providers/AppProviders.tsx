import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';

import { router } from '@/app/router';
import { Toaster } from '@/shared/ui/sonner';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { TooltipProvider } from '@/shared/ui/tooltip';

import { AuthProvider } from './AuthProvider';
import { NotificationsProvider } from './NotificationsProvider';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationsProvider>
            <TooltipProvider delayDuration={200}>
              <Suspense fallback={<div className="p-6"><LoadingState rows={4} /></div>}>
                <RouterProvider router={router} />
              </Suspense>
              <Toaster />
            </TooltipProvider>
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
