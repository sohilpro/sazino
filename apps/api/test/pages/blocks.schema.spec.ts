import {
  BlocksValidationError,
  MAX_BLOCKS,
  collectImageIds,
  defaultHomeBlocks,
  parseBlocks,
  parseStoredLenient,
} from '../../src/pages/blocks.schema';
import { isSafeHref } from '../../src/pages/safe-href';

const hero = (props: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  type: 'hero',
  props: { title: 'سلام', ...props },
  ...extra,
});
const grid = (props: Record<string, unknown> = {}) => ({ type: 'product-grid', props });
const text = (content: string, props: Record<string, unknown> = {}) => ({
  type: 'rich-text',
  props: { content, ...props },
});

const messages = (input: unknown): string[] => {
  try {
    parseBlocks(input);
  } catch (err) {
    if (err instanceof BlocksValidationError) return err.messages;
  }
  return [];
};

describe('isSafeHref', () => {
  it('accepts internal paths and https urls', () => {
    for (const href of ['/', '/products', '/p/about?x=1#y', '/categories/لوازم-دیجیتال', 'https://example.com/a?b=1']) {
      expect(isSafeHref(href)).toBe(true);
    }
  });

  it('rejects everything else', () => {
    for (const href of [
      '',
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>',
      'vbscript:x',
      'http://example.com',
      '//evil.com',
      '/\\evil.com',
      '/ spaced',
      'products',
      'https://user:pass@example.com',
      'https://',
      'https://exa mple.com',
      '/\u0000x',
      `/${'a'.repeat(600)}`,
    ]) {
      expect(isSafeHref(href)).toBe(false);
    }
  });
});

describe('parseBlocks', () => {
  it('fills defaults, trims text and generates ids', () => {
    const [h, g, t] = parseBlocks([
      hero({ title: '  عنوان  ', subtitle: '', ctaLabel: '  ' }),
      grid(),
      text('سلام\r\nدنیا'),
    ]);

    expect(h).toMatchObject({
      type: 'hero',
      props: { title: 'عنوان', subtitle: null, ctaLabel: null, ctaHref: null, imageId: null, align: 'center' },
    });
    expect(g).toMatchObject({
      type: 'product-grid',
      props: { title: null, source: 'latest', categorySlug: null, limit: 8, columns: 4 },
    });
    expect(t).toMatchObject({ type: 'rich-text', props: { content: 'سلام\nدنیا', align: 'start' } });

    const ids = [h!.id, g!.id, t!.id];
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it('keeps explicit ids and accepts an empty list', () => {
    expect(parseBlocks([hero({}, { id: 'my_hero-1' })])[0]!.id).toBe('my_hero-1');
    expect(parseBlocks([])).toEqual([]);
  });

  it('forgets the category slug when the source is "latest"', () => {
    const [g] = parseBlocks([grid({ source: 'latest', categorySlug: 'پوشاک' })]);
    expect(g!.props).toMatchObject({ source: 'latest', categorySlug: null });
  });

  it('lowercases and validates the category slug', () => {
    const [g] = parseBlocks([grid({ source: 'category', categorySlug: ' Shoes-2 ' })]);
    expect(g!.props).toMatchObject({ categorySlug: 'shoes-2' });
    expect(messages([grid({ source: 'category', categorySlug: 'bad slug' })]).length).toBeGreaterThan(0);
  });

  it('rejects structurally wrong input', () => {
    expect(messages('not an array')).toHaveLength(1);
    expect(messages([null])).not.toHaveLength(0);
    expect(messages([{ type: 'carousel', props: {} }])).not.toHaveLength(0);
    expect(messages([{ props: { title: 'x' } }])).not.toHaveLength(0);
  });

  it('rejects unknown fields (strict objects)', () => {
    expect(messages([hero({ onclick: 'x' })])).not.toHaveLength(0);
    expect(messages([{ ...hero(), extra: 1 }])).not.toHaveLength(0);
  });

  it('validates every block field', () => {
    for (const bad of [
      hero({ title: '' }),
      hero({ title: 'x'.repeat(121) }),
      hero({ align: 'left' }),
      hero({ imageId: 'not-a-uuid' }),
      hero({ ctaLabel: 'برو' }), // بدون آدرس
      hero({ ctaHref: '/products' }), // بدون متن
      hero({ ctaLabel: 'برو', ctaHref: 'javascript:alert(1)' }),
      hero({ ctaLabel: 'برو', ctaHref: '//evil.com' }),
      grid({ limit: 1 }),
      grid({ limit: 25 }),
      grid({ limit: 2.5 }),
      grid({ columns: 5 }),
      grid({ source: 'category' }), // بدون slug
      grid({ source: 'random' }),
      text(''),
      text('   \n  '),
      text('x'.repeat(5001)),
      text('ok', { align: 'end' }),
    ]) {
      expect(messages([bad]).length, JSON.stringify(bad)).toBeGreaterThan(0);
    }
  });

  it('points at the failing block and field', () => {
    const [message] = messages([hero(), hero({ title: '' })]);
    expect(message).toContain('بلاک 2');
    expect(message).toContain('props.title');
  });

  it('accepts a valid call to action and a safe external link', () => {
    const [h] = parseBlocks([hero({ ctaLabel: 'خرید', ctaHref: 'https://example.com/shop' })]);
    expect(h!.props).toMatchObject({ ctaLabel: 'خرید', ctaHref: 'https://example.com/shop' });
  });

  it('removes control characters from rich text but keeps line breaks', () => {
    const [t] = parseBlocks([text('a\u0000b\u0007c\nd\te')]);
    expect(t!.props).toMatchObject({ content: 'abc\nd\te' });
  });

  it('stores html-looking text as plain text (rendering escapes it)', () => {
    const [t] = parseBlocks([text('<script>alert(1)</script>')]);
    expect(t!.props).toMatchObject({ content: '<script>alert(1)</script>' });
  });

  it('rejects duplicate ids, too many blocks and oversized pages', () => {
    expect(messages([hero({}, { id: 'a' }), grid({ id: 'x' } as never), hero({}, { id: 'a' })])).not.toHaveLength(0);
    expect(messages(Array.from({ length: MAX_BLOCKS + 1 }, () => hero()))).toHaveLength(1);

    const big = Array.from({ length: 20 }, () => text('م'.repeat(4000)));
    expect(messages(big)).toEqual(['حجم محتوای صفحه بیش از حد مجاز است']);
  });
});

describe('parseStoredLenient', () => {
  it('drops invalid blocks instead of throwing', () => {
    const valid = hero({}, { id: 'ok' });
    const blocks = parseStoredLenient([
      { type: 'evil' },
      42,
      null,
      valid,
      hero({ ctaLabel: 'x', ctaHref: 'javascript:alert(1)' }),
      'text',
    ]);
    expect(blocks.map((b) => b.id)).toEqual(['ok']);
  });

  it('returns an empty list for non-arrays', () => {
    for (const value of [null, undefined, {}, 'x', 5]) expect(parseStoredLenient(value)).toEqual([]);
  });

  it('never returns more than the maximum number of blocks', () => {
    const many = Array.from({ length: MAX_BLOCKS + 10 }, (_, i) => hero({}, { id: `b${i}` }));
    expect(parseStoredLenient(many)).toHaveLength(MAX_BLOCKS);
  });
});

describe('helpers', () => {
  it('collects unique hero image ids', () => {
    const id = '019a0000-0000-7000-8000-000000000001';
    const blocks = parseBlocks([hero({ imageId: id }), hero({ imageId: id }), grid(), hero()]);
    expect(collectImageIds(blocks)).toEqual([id]);
  });

  it('builds a valid default home page', () => {
    const blocks = defaultHomeBlocks({ title: 'فروشگاه', subtitle: null });
    expect(blocks.map((b) => b.type)).toEqual(['hero', 'product-grid']);
    // خروجی پیش‌فرض باید از schema رد شود
    expect(() => parseBlocks(blocks)).not.toThrow();
  });
});