import { Headset } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  const { t } = useTranslation(['common']);
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de marca (desktop) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sidebar-accent/25 blur-3xl"
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent text-white shadow-sm">
            <Headset className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">{t('common:appName')}</span>
        </div>
        <div className="relative max-w-md space-y-3">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Gestiona tickets, empleados y SLA en un solo lugar.
          </h2>
          <p className="text-sidebar-muted">
            Plataforma de mesa de ayuda con bot de WhatsApp e inteligencia artificial.
          </p>
        </div>
        <p className="relative text-xs text-sidebar-muted">© Servigpoder · NextByte</p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center bg-muted/30 p-6">
        <Outlet />
      </div>
    </div>
  );
}
