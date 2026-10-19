import { Paperclip, X } from 'lucide-react';
import { useRef } from 'react';

import { cn } from '@/shared/lib/cn';

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Selector de varios archivos con lista y quitar. */
export function FileInput({
  files,
  onChange,
  accept,
  max = 10,
  label = 'Adjuntar archivos',
  className,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  max?: number;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={files.length >= max}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
      >
        <Paperclip className="h-4 w-4" />
        {label} {files.length > 0 && `(${files.length}/${max})`}
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          onChange([...files, ...picked].slice(0, max));
          e.target.value = '';
        }}
      />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
              <button
                type="button"
                aria-label={`Quitar ${f.name}`}
                className="rounded p-0.5 hover:bg-background"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
