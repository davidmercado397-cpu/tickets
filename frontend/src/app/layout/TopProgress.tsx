import { useIsFetching } from '@tanstack/react-query';

import { cn } from '@/shared/lib/cn';

/** Barra de progreso superior: visible mientras haya queries en vuelo. */
export function TopProgress() {
  const fetching = useIsFetching();
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-200',
        fetching ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="h-full w-1/3 animate-[indeterminate_1.1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
