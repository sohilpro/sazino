import { describe, expect, it } from 'vitest';
import {
  STORE_FONTS,
  brandTextColor,
  contrastColor,
  contrastRatio,
  isHexColor,
  lowContrastOnWhite,
} from '../app/utils/theme';

describe('colors', () => {
  it('validates #rrggbb', () => {
    for (const v of ['#4f46e5', '#FFFFFF', '#abcdef']) expect(isHexColor(v)).toBe(true);
    for (const v of ['4f46e5', '#fff', '#12345g', 'red', '', '#1234567'])
      expect(isHexColor(v)).toBe(false);
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('picks a readable button text color', () => {
    expect(contrastColor('#ffffff')).toBe('#111827');
    expect(contrastColor('#facc15')).toBe('#111827');
    expect(contrastColor('#000000')).toBe('#ffffff');
    expect(contrastColor('#4f46e5')).toBe('#ffffff');
  });

  it('darkens the brand text color by about 15 percent', () => {
    expect(brandTextColor('#ffffff')).toBe('#d9d9d9');
    expect(brandTextColor('#000000')).toBe('#000000');
  });

  it('warns for light colors only', () => {
    for (const light of ['#ffffff', '#facc15', '#a5f3fc'])
      expect(lowContrastOnWhite(light)).toBe(true);
    for (const dark of ['#4f46e5', '#e11d48', '#000000', '#0f766e'])
      expect(lowContrastOnWhite(dark)).toBe(false);
  });
});

describe('fonts', () => {
  it('offers the same keys as the API (one local font for now)', () => {
    expect(STORE_FONTS.map((f) => f.key)).toEqual(['vazirmatn']);
  });
});
