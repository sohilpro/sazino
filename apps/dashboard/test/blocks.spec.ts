import { describe, expect, it } from 'vitest';
import type { StoredBlock } from '@myapp/shared-types';
import {
  MAX_BLOCKS,
  MAX_RICH_TEXT,
  blockSummary,
  cloneBlock,
  contentSignature,
  createBlock,
  isSafeHref,
  moveBlock,
  newId,
  normalizeBlock,
  validateBlock,
  validateBlocks,
} from '../app/utils/blocks';

const hero = (props: Partial<Extract<StoredBlock, { type: 'hero' }>['props']> = {}): StoredBlock => ({
  id: 'h',
  type: 'hero',
  props: { title: 'سلام', subtitle: null, align: 'center', ctaLabel: null, ctaHref: null, imageId: null, ...props },
});
const grid = (props: Partial<Extract<StoredBlock, { type: 'product-grid' }>['props']> = {}): StoredBlock => ({
  id: 'g',
  type: 'product-grid',
  props: { title: null, source: 'latest', categorySlug: null, limit: 8, columns: 4, ...props },
});
const text = (content: string): StoredBlock => ({ id: 't', type: 'rich-text', props: { content, align: 'start' } });

describe('createBlock / cloneBlock', () => {
  it('every new block passes validation', () => {
    for (const type of ['hero', 'product-grid', 'rich-text'] as const) {
      expect(validateBlock(createBlock(type))).toEqual([]);
    }
  });

  it('creates unique ids that the server accepts', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
  });

  it('clones deeply with a new id', () => {
    const original = hero({ title: 'اصلی' });
    const copy = cloneBlock(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.type).toBe('hero');

    if (copy.type === 'hero' && original.type === 'hero') {
      copy.props.title = 'تغییر';
      expect(original.props.title).toBe('اصلی');
    }
  });
});

describe('moveBlock', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('moves an item up and down without mutating the input', () => {
    expect(moveBlock(list, 2, 1)).toEqual(['a', 'c', 'b', 'd']);
    expect(moveBlock(list, 1, 2)).toEqual(['a', 'c', 'b', 'd']);
    expect(moveBlock(list, 0, 3)).toEqual(['b', 'c', 'd', 'a']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores impossible moves', () => {
    expect(moveBlock(list, 0, -1)).toEqual(list);
    expect(moveBlock(list, 3, 4)).toEqual(list);
    expect(moveBlock(list, 2, 2)).toEqual(list);
    expect(moveBlock(list, 9, 0)).toEqual(list);
    expect(moveBlock([], 0, 1)).toEqual([]);
  });
});

describe('isSafeHref', () => {
  it('accepts internal paths and https', () => {
    for (const href of ['/', '/products', '/p/about?x=1', 'https://example.com/a']) {
      expect(isSafeHref(href)).toBe(true);
    }
  });

  it('rejects dangerous or malformed links', () => {
    for (const href of ['', 'javascript:alert(1)', 'data:text/html,x', 'http://x.test', '//evil.com', '/\\evil', 'products', 'https://u:p@x.test']) {
      expect(isSafeHref(href)).toBe(false);
    }
  });
});

describe('validateBlock', () => {
  it('validates hero fields', () => {
    expect(validateBlock(hero({ title: '  ' }))).toContain('عنوان بنر را وارد کنید');
    expect(validateBlock(hero({ title: 'x'.repeat(121) }))).toHaveLength(1);
    expect(validateBlock(hero({ ctaLabel: 'برو' }))).toContain('متن دکمه و آدرس آن باید با هم پر شوند');
    expect(validateBlock(hero({ ctaHref: '/products' }))).toContain('متن دکمه و آدرس آن باید با هم پر شوند');
    expect(validateBlock(hero({ ctaLabel: 'برو', ctaHref: 'javascript:alert(1)' }))[0]).toContain('آدرس دکمه نامعتبر');
    expect(validateBlock(hero({ ctaLabel: 'برو', ctaHref: '/products' }))).toEqual([]);
  });

  it('validates product grids', () => {
    expect(validateBlock(grid({ limit: 1 }))).toHaveLength(1);
    expect(validateBlock(grid({ limit: 25 }))).toHaveLength(1);
    expect(validateBlock(grid({ limit: 2.5 }))).toHaveLength(1);
    expect(validateBlock(grid({ limit: Number.NaN }))).toHaveLength(1);
    expect(validateBlock(grid({ source: 'category' }))).toContain('یک دسته‌بندی انتخاب کنید');
    expect(validateBlock(grid({ source: 'category', categorySlug: 'bad slug' }))).toContain('دسته‌بندی نامعتبر است');
    expect(validateBlock(grid({ source: 'category', categorySlug: 'لوازم-دیجیتال' }))).toEqual([]);
  });

  it('validates rich text', () => {
    expect(validateBlock(text('  \n '))).toContain('متن را وارد کنید');
    expect(validateBlock(text('x'.repeat(MAX_RICH_TEXT + 1)))).toHaveLength(1);
    expect(validateBlock(text('سلام'))).toEqual([]);
  });
});

describe('validateBlocks', () => {
  it('reports errors by block index and limits the count', () => {
    const result = validateBlocks([hero(), hero({ title: '' }), text('')]);
    expect(result.valid).toBe(false);
    expect(Object.keys(result.byIndex)).toEqual(['1', '2']);

    expect(validateBlocks([hero()]).valid).toBe(true);
    expect(validateBlocks([]).valid).toBe(true);

    const tooMany = validateBlocks(Array.from({ length: MAX_BLOCKS + 1 }, () => hero()));
    expect(tooMany.global).toHaveLength(1);
    expect(tooMany.valid).toBe(false);
  });
});

describe('normalizeBlock / contentSignature', () => {
  it('trims text, turns blanks into null and coerces numbers', () => {
    const [h, g] = [
      normalizeBlock(hero({ title: '  عنوان ', subtitle: '  ', ctaLabel: ' ', ctaHref: ' ' })),
      normalizeBlock(grid({ title: ' ', limit: '8' as unknown as number, columns: '3' as unknown as 3 })),
    ];
    expect(h).toMatchObject({ props: { title: 'عنوان', subtitle: null, ctaLabel: null, ctaHref: null } });
    expect(g).toMatchObject({ props: { title: null, limit: 8, columns: 3 } });
  });

  it('forgets the category slug unless the source is a category', () => {
    expect(normalizeBlock(grid({ source: 'latest', categorySlug: 'x' })).props).toMatchObject({ categorySlug: null });
    expect(normalizeBlock(grid({ source: 'category', categorySlug: ' Shoes ' })).props).toMatchObject({ categorySlug: 'shoes' });
  });

  it('normalizes line endings in text', () => {
    expect(normalizeBlock(text('a\r\nb')).props).toMatchObject({ content: 'a\nb' });
  });

  it('does not count whitespace-only edits as changes', () => {
    const before = contentSignature('عنوان', [hero({ title: 'سلام' })]);
    expect(contentSignature(' عنوان ', [hero({ title: ' سلام ' })])).toBe(before);
    expect(contentSignature('عنوان', [hero({ title: 'سلام!' })])).not.toBe(before);
    expect(contentSignature('عنوان', [hero({ title: 'سلام' }), text('x')])).not.toBe(before);
  });

  it('detects a reorder', () => {
    const a = [hero(), text('x')];
    expect(contentSignature('t', a)).not.toBe(contentSignature('t', [a[1]!, a[0]!]));
  });
});

describe('blockSummary', () => {
  it('describes each block briefly', () => {
    expect(blockSummary(hero({ title: 'تخفیف' }))).toBe('تخفیف');
    expect(blockSummary(grid())).toBe('جدیدترین محصولات');
    expect(blockSummary(grid({ source: 'category', categorySlug: 'x' }))).toBe('محصولات یک دسته');
    expect(blockSummary(grid({ title: 'پیشنهاد' }))).toBe('پیشنهاد');
    expect(blockSummary(text('\n# عنوان بلند\nمتن'))).toBe('عنوان بلند');
    expect(blockSummary(text(`${'ا'.repeat(60)}`))).toHaveLength(41);
  });
});