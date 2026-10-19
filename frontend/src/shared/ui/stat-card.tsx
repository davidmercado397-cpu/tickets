import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

/** Tarjeta de indicador (KPI). */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  const toneCls = {
    default: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-destructive bg-destructive/10',
  }[tone ?? 'default'];
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card p-4 shadow-xs',
        onClick && 'cursor-pointer transition-shadow hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm leading-snug text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        {Icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneCls)}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
