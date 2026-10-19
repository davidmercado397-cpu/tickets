import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { tenantApi } from '@/shared/api/endpoints';
import { cn } from '@/shared/lib/cn';

/** Logo de la empresa (si lo tiene) o un ícono genérico. */
export function BrandMark({
  slug,
  hasLogo,
  className,
  version,
}: {
  slug?: string | null;
  hasLogo?: boolean;
  className?: string;
  version?: string | number;
}) {
  const [broken, setBroken] = useState(false);
  if (slug && hasLogo && !broken) {
    return (
      <img
        src={`${tenantApi.logoUrl(slug)}${version ? `?v=${version}` : ''}`}
        alt="Logo"
        onError={() => setBroken(true)}
        className={cn('h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5', className)}
      />
    );
  }
  return (
    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-white shadow-sm', className)}>
      <ShieldCheck className="h-5 w-5" />
    </div>
  );
}
