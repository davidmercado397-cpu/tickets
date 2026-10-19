import { Camera, Loader2, Star } from 'lucide-react';
import { useRef, useState } from 'react';

import type { FormField } from '@/shared/api/types';
import { cn } from '@/shared/lib/cn';
import { AuthImage } from '@/shared/ui/auth-image';
import { Checkbox } from '@/shared/ui/checkbox';
import { NativeSelect } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';

import { SignaturePad } from './SignaturePad';

const YESNO = [
  { v: 'yes', l: 'Sí' },
  { v: 'no', l: 'No' },
  { v: 'na', l: 'No aplica' },
];

export interface PhotoSupport {
  upload: (fieldId: string, file: File) => Promise<string>;
  path: (fileId: string) => string;
}

/** Pinta un campo del formulario dinámico (diligenciar, previsualizar o consultar). */
export function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
  photos,
  highlight,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  photos?: PhotoSupport;
  highlight?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (field.type === 'section') {
    return <h3 className="border-b pb-1 pt-3 text-base font-semibold text-primary">{field.label}</h3>;
  }

  const label = (
    <p className="text-sm font-medium">
      {field.label}
      {field.required && <span className="ml-0.5 text-destructive">*</span>}
    </p>
  );

  let control: React.ReactNode = null;
  switch (field.type) {
    case 'text':
      control = <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
      break;
    case 'textarea':
      control = <Textarea rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
      break;
    case 'number':
      control = (
        <Input
          type="number"
          inputMode="decimal"
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          disabled={disabled}
        />
      );
      break;
    case 'date':
      control = <Input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} disabled={disabled} />;
      break;
    case 'select':
      control = (
        <NativeSelect value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} disabled={disabled}>
          <option value="">Selecciona…</option>
          {(field.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </NativeSelect>
      );
      break;
    case 'multiselect': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div className="grid gap-2 sm:grid-cols-2">
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox
                checked={arr.includes(o)}
                disabled={disabled}
                onCheckedChange={(c) => onChange(c ? [...arr, o] : arr.filter((x) => x !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    }
    case 'yesno':
      control = (
        <div className="grid grid-cols-3 gap-2">
          {YESNO.map((o) => (
            <button
              key={o.v}
              type="button"
              disabled={disabled}
              onClick={() => onChange(value === o.v ? null : o.v)}
              className={cn(
                'rounded-md border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-70',
                value === o.v
                  ? o.v === 'yes'
                    ? 'border-success bg-success/15 text-success'
                    : o.v === 'no'
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : 'border-muted-foreground bg-muted'
                  : 'hover:bg-muted',
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
      );
      break;
    case 'rating': {
      const min = field.min ?? 1;
      const max = field.max ?? 5;
      const n = typeof value === 'number' ? value : 0;
      control = (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((v) => (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onChange(v)}
              className="rounded p-1 disabled:opacity-80"
              aria-label={`${v}`}
            >
              <Star className={cn('h-8 w-8', v <= n ? 'fill-warning text-warning' : 'text-muted-foreground/40')} />
            </button>
          ))}
          {n > 0 && <span className="self-center pl-2 text-sm text-muted-foreground">{n} / {max}</span>}
        </div>
      );
      break;
    }
    case 'photo': {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div className="space-y-2">
          {ids.length > 0 && photos && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {ids.map((fid) => (
                <AuthImage key={fid} path={photos.path(fid)} alt="Foto" className="aspect-square w-full rounded-md" />
              ))}
            </div>
          )}
          {!disabled && photos && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Tomar o subir foto
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setUploading(true);
                  try {
                    const id = await photos.upload(field.id, file);
                    onChange([...ids, id]);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </>
          )}
          {!photos && <p className="text-xs text-muted-foreground">Se habilita al diligenciar la visita.</p>}
        </div>
      );
      break;
    }
    case 'signature':
      control = disabled && typeof value === 'string' ? (
        <img src={value} alt="Firma" className="h-32 rounded-md border bg-white object-contain" />
      ) : disabled ? (
        <p className="text-sm text-muted-foreground">Sin firma</p>
      ) : (
        <SignaturePad value={value as string | null} onChange={onChange} />
      );
      break;
  }

  return (
    <div className={cn('space-y-2 rounded-lg', highlight && 'bg-destructive/5 p-2 ring-1 ring-destructive/30')}>
      {label}
      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
      {control}
    </div>
  );
}
