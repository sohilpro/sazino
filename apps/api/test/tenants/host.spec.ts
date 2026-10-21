import { isIpv4, normalizeHost } from '../../src/tenants/host';

describe('normalizeHost', () => {
  it('lowercases and strips the port', () => {
    expect(normalizeHost('Demo.Localhost:4000')).toBe('demo.localhost');
    expect(normalizeHost('localhost:4000')).toBe('localhost');
  });

  it('strips a trailing dot', () => {
    expect(normalizeHost('shop.example.com.')).toBe('shop.example.com');
  });

  it('uses the first value of a comma-separated list', () => {
    expect(normalizeHost('a.example.com, b.example.com')).toBe('a.example.com');
  });

  it('accepts punycode (IDN) hosts', () => {
    expect(normalizeHost('xn--mgbaam7a8h.example')).toBe('xn--mgbaam7a8h.example');
  });

  it('rejects invalid values', () => {
    expect(normalizeHost(undefined)).toBeNull();
    expect(normalizeHost('')).toBeNull();
    expect(normalizeHost('[::1]:4000')).toBeNull();
    expect(normalizeHost('bad_host.com')).toBeNull();
    expect(normalizeHost('a..com')).toBeNull();
    expect(normalizeHost('-a.com')).toBeNull();
    expect(normalizeHost('a/b.com')).toBeNull();
    expect(normalizeHost('x'.repeat(254))).toBeNull();
  });

  it('detects IPv4', () => {
    expect(isIpv4('127.0.0.1')).toBe(true);
    expect(isIpv4('demo.localhost')).toBe(false);
  });
});