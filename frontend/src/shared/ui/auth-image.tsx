import { useEffect, useState } from 'react';

import { httpBlob } from '@/shared/api/http';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from '@/shared/ui/skeleton';

/** Imagen protegida: se descarga con el token (fotos de visitas, firmas). */
export function AuthImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    httpBlob(path)
      .then((b) => {
        if (!alive) return;
        revoked = URL.createObjectURL(b);
        setUrl(revoked);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [path]);
  if (failed) return <div className={cn('rounded-md bg-muted text-xs text-muted-foreground', className)}>Sin imagen</div>;
  if (!url) return <Skeleton className={className} />;
  return <img src={url} alt={alt} className={cn('object-cover', className)} />;
}
