import { describe, expect, it } from 'vitest';
import { isPlatformHost } from '../app/utils/platform';

describe('isPlatformHost', () => {
  it('identifies localhost as platform host', () => {
    expect(isPlatformHost('localhost:3000')).toBe(true);
    expect(isPlatformHost('localhost')).toBe(true);
    expect(isPlatformHost('127.0.0.1:3000')).toBe(true);
    expect(isPlatformHost('127.0.0.1')).toBe(true);
    expect(isPlatformHost('www.localhost:3000')).toBe(true);
  });

  it('identifies tenant subdomains on localhost as non-platform', () => {
    expect(isPlatformHost('demo.localhost:3000')).toBe(false);
    expect(isPlatformHost('acme.localhost:3000')).toBe(false);
    expect(isPlatformHost('my-store.localhost')).toBe(false);
  });

  it('identifies custom domains as non-platform', () => {
    expect(isPlatformHost('myshop.ir:3000')).toBe(false);
    expect(isPlatformHost('brand.com')).toBe(false);
  });

  it('works with custom production platform domain', () => {
    const prodDomain = 'sazino.ir';
    expect(isPlatformHost('sazino.ir', prodDomain)).toBe(true);
    expect(isPlatformHost('www.sazino.ir', prodDomain)).toBe(true);
    expect(isPlatformHost('sazino.ir:443', prodDomain)).toBe(true);
    expect(isPlatformHost('app.sazino.ir', prodDomain)).toBe(true); // reserved
    expect(isPlatformHost('shiraz-mod.sazino.ir', prodDomain)).toBe(false); // store
    expect(isPlatformHost('custom-store.com', prodDomain)).toBe(false);
  });

  it('handles empty or missing host gracefully', () => {
    expect(isPlatformHost(undefined)).toBe(true);
    expect(isPlatformHost('')).toBe(true);
  });
});
