import { Link } from 'react-router-dom';

import { Button } from '@/shared/ui/button';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-4xl font-semibold">404</p>
      <p className="text-muted-foreground">Página no encontrada.</p>
      <Button asChild variant="outline">
        <Link to="/">Ir al inicio</Link>
      </Button>
    </div>
  );
}
