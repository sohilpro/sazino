import { describe, expect, it } from 'vitest';
import { buildCacheKey, canonicalQuery, isCacheablePath } from '../../src/cache/cache-key';

const base = { tenantId: 't1', version: '0', path: '/api/storefront/products', query: {} };

describe('isCacheablePath', () => {
  it('allows exactly the public catalog reads', () => {
    for (const p of [
      '/api/store',
      '/api/store/',
      '/api/storefront/products',
      '/api/storefront/products/some-slug',
      '/api/storefront/categories',
      '/api/storefront/categories/shoes',
      '/api/storefront/pages/about',
      '/api/storefront/sitemap-urls',
    ]) {
      expect(isCacheablePath(p), p).toBe(true);
    }
  });

  it('never caches anything personal under /api/storefront', () => {
    for (const p of [
      '/api/storefront/cart',
      '/api/storefront/cart/items/x',
      '/api/storefront/customer',
      '/api/storefront/orders',
      '/api/storefront/orders/1001',
      '/api/storefront/addresses',
      '/api/storefront/checkout/quote',
      '/api/storefront/auth/session',
      '/api/storefront/shipping-methods',
      '/api/storefront/payments/callback',
      '/api/products',
      '/api/admin/tenants',
      '/api/store-settings',
      '/',
    ]) {
      expect(isCacheablePath(p), p).toBe(false);
    }
  });
});

describe('canonicalQuery', () => {
  it('ignores parameter order', () => {
    expect(canonicalQuery({ sort: 'newest', page: '2' })).toBe(
      canonicalQuery({ page: '2', sort: 'newest' }),
    );
  });

  it('rejects unknown, repeated, nested and long values', () => {
    expect(canonicalQuery({ utm_source: 'x' })).toBeNull();
    expect(canonicalQuery({ preview: 'token' })).toBeNull();
    expect(canonicalQuery({ page: ['1', '2'] })).toBeNull();
    expect(canonicalQuery({ q: { a: '1' } })).toBeNull();
    expect(canonicalQuery({ q: 'x'.repeat(101) })).toBeNull();
    expect(canonicalQuery({ q: 'x'.repeat(100) })).not.toBeNull();
  });
});

describe('buildCacheKey', () => {
  it('separates tenants, versions, paths and queries', () => {
    const keys = new Set([
      buildCacheKey(base),
      buildCacheKey({ ...base, tenantId: 't2' }),
      buildCacheKey({ ...base, version: '1' }),
      buildCacheKey({ ...base, path: '/api/storefront/categories' }),
      buildCacheKey({ ...base, query: { page: '2' } }),
    ]);
    expect(keys.size).toBe(5);
    expect(keys.has(null)).toBe(false);
  });

  it('is stable for equivalent requests', () => {
    expect(buildCacheKey({ ...base, query: { page: '2', sort: 'a' } })).toBe(
      buildCacheKey({ ...base, path: '/api/storefront/products/', query: { sort: 'a', page: '2' } }),
    );
  });

  it("starts with the tenant so one store can never read another's entries", () => {
    expect(buildCacheKey(base)).toMatch(/^sfcache:t1:0:[0-9a-f]{32}$/);
  });

  it('returns null for anything that must not be cached', () => {
    expect(buildCacheKey({ ...base, path: '/api/storefront/cart' })).toBeNull();
    expect(buildCacheKey({ ...base, query: { foo: 'bar' } })).toBeNull();
    expect(
      buildCacheKey({ ...base, path: '/api/storefront/pages/about', query: { preview: 'tok' } }),
    ).toBeNull();
  });
});