import { hexToHsl, readableOn } from './brand';

describe('marca dinámica', () => {
  it('convierte hex a HSL', () => {
    expect(hexToHsl('#0B3D91')).toEqual([218, 86, 31]);
    expect(hexToHsl('ffffff')).toEqual([0, 0, 100]);
    expect(hexToHsl('no-es-color')).toBeNull();
  });

  it('elige un texto legible sobre el color', () => {
    expect(readableOn('#0B3D91')).toBe('#ffffff');
    expect(readableOn('#F2F2F2')).toBe('#000000');
  });
});
