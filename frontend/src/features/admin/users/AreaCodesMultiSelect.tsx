import { useAreas } from '@/shared/hooks/useCatalog';
import { Checkbox } from '@/shared/ui/checkbox';

interface Props {
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}

/** Selección múltiple de áreas (lista de checkboxes). Solo relevante para agentes. */
export function AreaCodesMultiSelect({ value, onChange, disabled }: Props) {
  const areas = useAreas(true);

  const toggle = (code: string, checked: boolean) => {
    if (checked) onChange([...value, code]);
    else onChange(value.filter((c) => c !== code));
  };

  return (
    <div className="max-h-40 space-y-2 overflow-auto rounded-md border p-3">
      {(areas.data ?? []).map((a) => (
        <label key={a.code} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={value.includes(a.code)}
            onCheckedChange={(c) => toggle(a.code, c === true)}
            disabled={disabled}
          />
          {a.name}
        </label>
      ))}
      {areas.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin áreas disponibles.</p>
      )}
    </div>
  );
}
