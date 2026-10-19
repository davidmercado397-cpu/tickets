import { describe, expect, it } from 'vitest';

import { slugify } from './slugify';

describe('slugify', () => {
  it('genera el code por slug del nombre', () => {
    expect(slugify('Recursos Humanos')).toBe('recursos-humanos');
  });

  it('normaliza tildes y ñ', () => {
    expect(slugify('Área Técnica')).toBe('area-tecnica');
    expect(slugify('Gestión de Nómina')).toBe('gestion-de-nomina');
  });

  it('colapsa separadores y recorta guiones en los bordes', () => {
    expect(slugify('  Soporte   //  N1  ')).toBe('soporte-n1');
    expect(slugify('¡Hola, Mundo!')).toBe('hola-mundo');
  });
});
