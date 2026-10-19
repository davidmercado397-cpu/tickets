import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

/** Insignia con tono (clases de color) para estados, prioridades y semáforos. */
export function Pill({ tone, children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        tone ?? 'border-border bg-muted text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}
