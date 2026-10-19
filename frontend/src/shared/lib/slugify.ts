/**
 * Genera un `code` a partir de un nombre (mismo criterio que el backend):
 * minúsculas, sin tildes (NFD), espacios→"-", solo [a-z0-9-], guiones colapsados.
 * Ej: "Área Técnica" → "area-tecnica".
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita marcas diacríticas combinantes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // no alfanumérico → guion
    .replace(/^-+|-+$/g, '') // sin guiones en los bordes
    .replace(/-{2,}/g, '-'); // colapsa guiones
}
