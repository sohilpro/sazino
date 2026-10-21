import { pickUniqueSlug, SLUG_REGEX, slugify, slugRoot } from '../../src/common/slug';

describe('slugify', () => {
  it('keeps Persian letters and joins words with a hyphen', () => {
    expect(slugify('لوازم دیجیتال')).toBe('لوازم-دیجیتال');
  });

  it('turns ZWNJ into a hyphen', () => {
    expect(slugify('می‌خواهم')).toBe('می-خواهم');
  });

  it('normalises Arabic yeh/kaf and digits', () => {
    expect(slugify('كتاب ي ١٢٣ ۴۵۶')).toBe('کتاب-ی-123-456');
  });

  it('lowercases latin text and strips symbols', () => {
    expect(slugify('Hello, World! 2026')).toBe('hello-world-2026');
  });

  it('trims separators', () => {
    expect(slugify('  --a  b-- ')).toBe('a-b');
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('respects the max length', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe('slugRoot / pickUniqueSlug', () => {
  it('falls back when the text has no usable characters', () => {
    expect(slugRoot('???', 'product')).toBe('product');
  });

  it('keeps room for a numeric suffix', () => {
    expect(slugRoot('a'.repeat(200), 'x').length).toBeLessThanOrEqual(74);
  });

  it('returns the root when it is free', () => {
    expect(pickUniqueSlug('shirt', new Set())).toBe('shirt');
  });

  it('appends the first free numeric suffix', () => {
    expect(pickUniqueSlug('shirt', new Set(['shirt', 'shirt-2']))).toBe('shirt-3');
  });
});

describe('SLUG_REGEX', () => {
  it('accepts valid slugs', () => {
    for (const s of ['abc', 'a-b-c', 'لوازم-دیجیتال', 'item-2', '2026']) {
      expect(SLUG_REGEX.test(s)).toBe(true);
    }
  });

  it('rejects invalid slugs', () => {
    for (const s of ['', '-a', 'a-', 'a--b', 'a b', 'a_b', 'a/b']) {
      expect(SLUG_REGEX.test(s)).toBe(false);
    }
  });
});