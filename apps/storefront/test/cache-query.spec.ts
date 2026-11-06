import { describe, expect, it } from 'vitest';
import { isCachedStorefrontPath, normalizeCachedUrl } from '../server/utils/cache-query';

describe('normalizeCachedUrl', () => {
  it('keeps only page and sort on cacheable paths', () => {
    expect(normalizeCachedUrl('/categories/shoes?utm_source=x&page=2&fbclid=1&sort=new')).toBe(
      '/categories/shoes?page=2&sort=new',
    );
    expect(normalizeCachedUrl('/?utm_campaign=a')).toBe('/');
  });

  it('gives the same URL regardless of order', () => {
    expect(normalizeCachedUrl('/categories/a?sort=new&page=2')).toBe(normalizeCachedUrl('/categories/a?page=2&sort=new'));
  });

  it('drops invalid values', () => {
    expect(normalizeCachedUrl('/categories/a?page=0')).toBe('/categories/a');
    expect(normalizeCachedUrl('/categories/a?page=abc')).toBe('/categories/a');
    expect(normalizeCachedUrl('/categories/a?page=99999')).toBe('/categories/a');
    expect(normalizeCachedUrl(`/categories/a?sort=${'x'.repeat(40)}`)).toBe('/categories/a');
    expect(normalizeCachedUrl('/categories/a?sort=<script>')).toBe('/categories/a');
  });

  it('leaves uncached paths untouched, including the preview', () => {
    expect(normalizeCachedUrl('/products?q=shoe&page=1')).toBe('/products?q=shoe&page=1');
    expect(normalizeCachedUrl('/cart?x=1')).toBe('/cart?x=1');
    expect(normalizeCachedUrl('/preview/p/about?preview=tok')).toBe('/preview/p/about?preview=tok');
  });
});

describe('isCachedStorefrontPath', () => {
  it('matches the cacheable routes only', () => {
    for (const p of ['/', '/products/x', '/categories/y', '/p/z']) expect(isCachedStorefrontPath(p)).toBe(true);
    for (const p of ['/products', '/cart', '/checkout', '/account', '/preview', '/preview/p/x', '/login']) {
      expect(isCachedStorefrontPath(p)).toBe(false);
    }
  });
});