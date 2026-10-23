import { describe, expect, it } from 'vitest';
import type { ProductDto } from '@myapp/shared-types';
import {
  breadcrumbJsonLd,
  plainText,
  productJsonLd,
  serializeJsonLd,
} from '../app/utils/seo';

const variant = (over: Partial<ProductDto['variants'][number]> = {}) => ({
  id: 'v1',
  title: 'پیش‌فرض',
  sku: null,
  price: 450_000,
  compareAtPrice: null,
  position: 0,
  inStock: true,
  ...over,
});

const product = (over: Partial<ProductDto> = {}): ProductDto => ({
  id: 'p1',
  title: 'تیشرت نخی',
  slug: 'تیشرت-نخی',
  description: 'توضیح کوتاه',
  status: 'ACTIVE',
  category: { id: 'c1', name: 'پوشاک', slug: 'پوشاک' },
  minPrice: 450_000,
  maxPrice: 450_000,
  inStock: true,
  variants: [variant({ sku: 'TS-1' })],
  images: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const ctx = { url: 'https://shop.example.com/products/x', storeName: 'فروشگاه دمو' };

describe('serializeJsonLd', () => {
  it('never lets the data close the script tag', () => {
    const evil = '</script><script>alert(1)</script>';
    const out = serializeJsonLd({ name: evil });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out.toLowerCase()).not.toContain('</script');
    expect(JSON.parse(out)).toEqual({ name: evil });
  });

  it('escapes ampersands and line separators but keeps Persian text', () => {
    const out = serializeJsonLd({ a: 'x&y', b: 'a\u2028b\u2029c', c: 'سلام' });
    expect(out).not.toContain('&');
    expect(out).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(out)).toEqual({ a: 'x&y', b: 'a\u2028b\u2029c', c: 'سلام' });
    expect(out).toContain('سلام');
  });
});

describe('productJsonLd', () => {
  it('builds a single Offer with the price converted from toman to rial', () => {
    const ld = productJsonLd(product(), ctx) as Record<string, any>;
    expect(ld['@type']).toBe('Product');
    expect(ld.sku).toBe('TS-1');
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'فروشگاه دمو' });
    expect(ld.offers).toMatchObject({
      '@type': 'Offer',
      priceCurrency: 'IRR',
      price: '4500000',
      availability: 'https://schema.org/InStock',
    });
  });

  it('builds an AggregateOffer for several variants', () => {
    const p = product({
      minPrice: 550_000,
      maxPrice: 570_000,
      variants: [
        variant({ id: 'a', title: 'مشکی', price: 550_000 }),
        variant({ id: 'b', title: 'سفید', price: 570_000, inStock: false }),
      ],
    });
    const ld = productJsonLd(p, ctx) as Record<string, any>;
    expect(ld.sku).toBeUndefined();
    expect(ld.offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '5500000',
      highPrice: '5700000',
      offerCount: 2,
      availability: 'https://schema.org/InStock',
    });
    expect(ld.offers.offers).toHaveLength(2);
    expect(ld.offers.offers[0].name).toBe('مشکی');
    expect(ld.offers.offers[1].availability).toBe('https://schema.org/OutOfStock');
  });

  it('reports out of stock', () => {
    const p = product({ inStock: false, variants: [variant({ inStock: false })] });
    const ld = productJsonLd(p, ctx) as Record<string, any>;
    expect(ld.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('includes images only when there are some', () => {
    expect(productJsonLd(product(), ctx)).not.toHaveProperty('image');

    const withImage = product({
      images: [
        {
          id: 'i1',
          alt: null,
          width: 10,
          height: 10,
          urls: { thumb: 't', sm: 's', md: 'm', lg: 'https://cdn.example.com/lg.webp' },
        },
      ],
    });
    expect((productJsonLd(withImage, ctx) as Record<string, unknown>).image).toEqual([
      'https://cdn.example.com/lg.webp',
    ]);
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers items from 1', () => {
    const ld = breadcrumbJsonLd([
      { name: 'خانه', url: 'https://x.test/' },
      { name: 'محصولات', url: 'https://x.test/products' },
    ]);
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement[1]).toMatchObject({ name: 'محصولات', item: 'https://x.test/products' });
  });
});

describe('plainText', () => {
  it('collapses whitespace and handles empty input', () => {
    expect(plainText('  a \n\n b   c ')).toBe('a b c');
    expect(plainText(null)).toBe('');
    expect(plainText(undefined)).toBe('');
  });

  it('truncates on a word boundary with an ellipsis', () => {
    const out = plainText('word '.repeat(100), 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });

  it('does not touch text that already fits', () => {
    expect(plainText('کوتاه', 160)).toBe('کوتاه');
  });
});