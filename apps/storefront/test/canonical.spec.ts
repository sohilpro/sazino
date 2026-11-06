import { describe, expect, it } from 'vitest';
import { canonicalRedirectTarget, shouldSkipCanonical } from '../server/utils/canonical';

describe('canonicalRedirectTarget', () => {
  const canonicalUrl = 'https://shop.example.com';

  it('redirects a non-canonical host and keeps path and query', () => {
    expect(
      canonicalRedirectTarget({ host: 'demo.platform.com', path: '/products/x?page=2', canonicalUrl }),
    ).toBe('https://shop.example.com/products/x?page=2');
  });

  it('does nothing on the canonical host (no loops), case-insensitively', () => {
    expect(canonicalRedirectTarget({ host: 'shop.example.com', path: '/', canonicalUrl })).toBeNull();
    expect(canonicalRedirectTarget({ host: 'SHOP.example.com', path: '/', canonicalUrl })).toBeNull();
  });

  it('respects ports', () => {
    expect(
      canonicalRedirectTarget({
        host: 'demo.localhost:3000',
        path: '/',
        canonicalUrl: 'http://demo.localhost:3000',
      }),
    ).toBeNull();
  });

  it('does nothing without a usable canonical URL', () => {
    expect(canonicalRedirectTarget({ host: 'a.com', path: '/', canonicalUrl: null })).toBeNull();
    expect(
      canonicalRedirectTarget({ host: 'a.com', path: '/', canonicalUrl: 'javascript:alert(1)' }),
    ).toBeNull();
    expect(canonicalRedirectTarget({ host: 'a.com', path: '/', canonicalUrl: 'nonsense' })).toBeNull();
  });

  it('never builds a protocol-relative target', () => {
    expect(canonicalRedirectTarget({ host: 'a.com', path: '//evil.com', canonicalUrl })).toBeNull();
  });
});

describe('shouldSkipCanonical', () => {
  it.each(['/api/store', '/_nuxt/x.js', '/sitemap.xml', '/robots.txt', '/dev/fake-gateway', '/api'])(
    'skips %s',
    (path) => expect(shouldSkipCanonical(path)).toBe(true),
  );

  it.each(['/', '/products/x', '/p/api', '/apiary', '/categories/a?x=1'])(
    'does not skip %s',
    (path) => expect(shouldSkipCanonical(path)).toBe(false),
  );
});