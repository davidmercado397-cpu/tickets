/** Marca dinámica: convierte el color de la empresa a los tokens HSL de shadcn y los aplica. */

export const DEFAULT_BRAND = { primary: '#0B3D91', secondary: '#F2A900' };

export function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1] ?? '0', 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

const fmt = ([h, s, l]: [number, number, number]) => `${h} ${s}% ${l}%`;

/** Aplica el color primario de la empresa (contenido, anillos y barra lateral). */
export function applyBrand(primary?: string | null, secondary?: string | null): void {
  const root = document.documentElement;
  const p = hexToHsl(primary || DEFAULT_BRAND.primary);
  const s = hexToHsl(secondary || DEFAULT_BRAND.secondary);
  if (!p) return;
  const [h, sat, l] = p;
  const vivid: [number, number, number] = [h, Math.max(sat, 45), Math.min(Math.max(l, 32), 48)];
  root.style.setProperty('--primary', fmt(vivid));
  root.style.setProperty('--ring', fmt(vivid));
  root.style.setProperty('--accent', fmt([h, Math.min(sat, 80), 96]));
  root.style.setProperty('--accent-foreground', fmt([h, Math.max(sat, 45), 30]));
  // Barra lateral oscura del tono de la marca.
  root.style.setProperty('--sidebar', fmt([h, Math.min(sat, 60), 13]));
  root.style.setProperty('--sidebar-border', fmt([h, Math.min(sat, 45), 21]));
  root.style.setProperty('--sidebar-accent', fmt(s ?? vivid));
  root.style.setProperty('--brand-secondary', fmt(s ?? vivid));
}

/** Color de texto legible (negro/blanco) sobre un fondo dado. */
export function readableOn(hex: string): '#000000' | '#ffffff' {
  const hsl = hexToHsl(hex);
  return hsl && hsl[2] > 60 ? '#000000' : '#ffffff';
}
