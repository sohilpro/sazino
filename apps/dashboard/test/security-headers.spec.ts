import { describe, expect, it } from 'vitest';
import { buildCsp, securityHeaders, toOrigin } from '../server/utils/security-headers';

describe('toOrigin', () => {
  it('keeps only a clean http(s) origin', () => {
    expect(toOrigin('https://media.example.com/bucket/x')).toBe('https://media.example.com');
    expect(toOrigin('javascript:alert(1)')).toBe('');
    expect(toOrigin('x; script-src *')).toBe('');
    expect(toOrigin(undefined)).toBe('');
  });
});

describe('buildCsp', () => {
  it('forbids framing, plugins and foreign base URIs', () => {
    const csp = buildCsp();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toContain('*');
  });

  it('allows images only from self, data and the media origin', () => {
    expect(buildCsp({ mediaOrigin: 'https://media.example.com' })).toContain(
      "img-src 'self' data: https://media.example.com",
    );
    expect(buildCsp({ mediaOrigin: 'evil; script-src *' })).toContain("img-src 'self' data:;");
  });

  it('adds connect and blob sources only when asked', () => {
    const csp = buildCsp({ connectOrigins: ['https://api.example.com/api'], allowBlobImages: true });
    expect(csp).toContain("connect-src 'self' https://api.example.com");
    expect(csp).toContain('blob:');
    expect(buildCsp()).not.toContain('blob:');
  });
});

describe('securityHeaders', () => {
  it('sets the standard hardening headers', () => {
    const headers = securityHeaders();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['content-security-policy']).toBeTruthy();
  });
});