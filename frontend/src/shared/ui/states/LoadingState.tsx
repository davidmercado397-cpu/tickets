import { Skeleton } from '@/shared/ui/skeleton';

interface LoadingStateProps {
  /** Número de filas skeleton (variante tabla). */
  rows?: number;
  label?: string;
}

/** Estado de carga estándar: filas skeleton. Toda superficie de datos lo usa. */
export function LoadingState({ rows = 6, label = 'Cargando…' }: LoadingStateProps) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
