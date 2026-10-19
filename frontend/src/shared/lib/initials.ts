/** Iniciales para avatares: de un nombre o correo. "Ana Pérez" → "AP", "a@b.co" → "A". */
export function initials(value: string | null | undefined): string {
  if (!value) return '?';
  const base = (value.includes('@') ? value.split('@')[0] : value) ?? value;
  const parts = base
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
