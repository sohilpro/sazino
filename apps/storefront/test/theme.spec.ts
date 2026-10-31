import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT, STORE_FONT_KEYS, safeFont } from '../app/utils/theme';

describe('safeFont', () => {
  it('passes the allowed keys', () => {
    for (const key of STORE_FONT_KEYS) expect(safeFont(key)).toBe(key);
  });

  it('turns anything else into the default font', () => {
    for (const value of ['Comic Sans', "Vazirmatn FD'] { x", '', null, undefined, 42, ['Vazirmatn FD']]) {
      expect(safeFont(value)).toBe(DEFAULT_FONT);
    }
  });
});