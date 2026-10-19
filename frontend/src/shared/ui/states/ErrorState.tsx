import { AlertTriangle } from 'lucide-react';

import { Button } from '@/shared/ui/button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/** Estado de error estándar con acción de reintento (conectada a refetch). */
export function ErrorState({
  title = 'Ocurrió un error',
  description = 'No se pudo cargar la información. Intenta de nuevo.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-10 text-center"
      role="alert"
    >
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
