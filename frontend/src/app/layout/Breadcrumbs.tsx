import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { BREADCRUMB_LABELS } from '@/app/layout/nav';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/shared/ui/breadcrumb';

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return <span className="text-sm font-medium">Tablero</span>;

  let acc = '';
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {segments.map((seg, i) => {
          acc += `/${seg}`;
          const isLast = i === segments.length - 1;
          const known = BREADCRUMB_LABELS[seg];
          const label = known ?? 'Detalle';
          return (
            <Fragment key={acc}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className={i < segments.length - 2 ? 'hidden sm:inline-flex' : undefined}>
                {isLast || !known || seg === 'config' ? (
                  <BreadcrumbPage className="truncate">{label}</BreadcrumbPage>
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
