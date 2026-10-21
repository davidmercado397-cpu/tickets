/**
 * Identificador del portal mientras se escribe: minúsculas, sin tildes, espacios → guion.
 * No recorta el guion final para poder seguir escribiendo ("seguridad-" → "seguridad-atlas").
 */
export function typingSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60);
}

/** Versión final (la misma regla que aplica el servidor). */
export function finalSlug(value: string): string {
  return typingSlug(value).replace(/-+$/, '');
}
