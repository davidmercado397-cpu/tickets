import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb';

/** Etiqueta i18n por segmento de ruta conocido. */
const LABELS: Record<string, string> = {
  tickets: 'tickets:title',
  admin: 'nav:administration',
  areas: 'admin:areas',
  categories: 'admin:categories',
  users: 'admin:users',
  employees: 'admin:employees',
  sla: 'admin:sla',
};

export function Breadcrumbs() {
  const { t } = useTranslation(['tickets', 'admin', 'nav', 'common']);
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  let acc = '';
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        {segments.map((seg, i) => {
          acc += `/${seg}`;
          const isLast = i === segments.length - 1;
          const known = LABELS[seg];
          const label = known ? t(known) : t('common:detail');
          return (
            <Fragment key={acc}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast || !known ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <Link to={acc} className="transition-colors hover:text-foreground">
                    {label}
                  </Link>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
