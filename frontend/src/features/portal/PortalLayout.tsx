import { useQuery } from '@tanstack/react-query';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';

import { publicApi, tenantApi } from '@/shared/api/endpoints';
import { applyBrand } from '@/shared/lib/brand';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { LoadingState } from '@/shared/ui/states/LoadingState';

export function PortalLayout() {
  const { slug = '' } = useParams();
  const q = useQuery({ queryKey: ['public-tenant', slug], queryFn: () => publicApi.tenant(slug), retry: false });

  useEffect(() => {
    if (q.data) {
      applyBrand(q.data.primary_color, q.data.secondary_color);
      document.title = `PQRS · ${q.data.name}`;
    }
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <LoadingState rows={5} />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <EmptyState title="Portal no disponible" description="Verifica la dirección o comunícate con la empresa." />
      </div>
    );
  }
  const t = q.data;
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b-4 bg-sidebar text-sidebar-foreground" style={{ borderColor: t.secondary_color }}>
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <Link to={`/portal/${t.slug}`} className="flex min-w-0 items-center gap-3">
            {t.has_logo ? (
              <img src={tenantApi.logoUrl(t.slug)} alt={t.name} className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain p-1" />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold leading-tight">{t.legal_name || t.name}</p>
              <p className="text-xs text-sidebar-muted">Peticiones, quejas, reclamos, sugerencias y felicitaciones</p>
            </div>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-6 sm:px-4">
        {t.portal.enabled ? (
          <Suspense fallback={<LoadingState rows={4} />}>
            <Outlet context={t} />
          </Suspense>
        ) : (
          <EmptyState title="Portal en mantenimiento" description="Por favor comunícate por nuestros canales de atención." />
        )}
      </main>
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 text-xs text-muted-foreground">
          {t.nit && <span>NIT {t.nit}</span>}
          {t.address && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {t.address}
              {t.city ? `, ${t.city}` : ''}
            </span>
          )}
          {t.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {t.phone}
            </span>
          )}
          {t.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              {t.email}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
