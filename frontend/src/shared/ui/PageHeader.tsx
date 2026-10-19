import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Acciones a la derecha (botones). */
  actions?: ReactNode;
  /** Breadcrumbs u otro contenido encima del título. */
  breadcrumbs?: ReactNode;
}

/** Cabecera de página consistente: breadcrumbs + título + descripción + acciones. */
export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {breadcrumbs}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
