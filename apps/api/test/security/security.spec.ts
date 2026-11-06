import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createProxyHeaderGuard, hasValidProxyToken } from '../../src/common/proxy-header-guard';
import { helmetOptions } from '../../src/common/security';

const TOKEN = 'secret-token-secret-token-secret-0';

type Headers = Record<string, string | undefined>;

function run(headers: Headers, opts: { required: boolean; token: string }) {
  // کلیدهای undefined اصلاً هدر نیستند (مثل درخواست واقعی)
  const defined = Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== undefined),
  );
  const req = { headers: defined } as unknown as Request;
  const next = vi.fn();
  createProxyHeaderGuard(opts)(req, {} as Response, next);
  return { headers: req.headers, next };
}

describe('proxy header guard', () => {
  const spoofed = {
    'x-tenant-host': 'victim.example.com',
    'x-forwarded-host': 'victim.example.com',
  };

  it('strips tenant-selecting headers when the token is missing or wrong', () => {
    const attempts: Headers[] = [{}, { 'x-internal-token': 'wrong' }, { 'x-internal-token': '' }];
    for (const extra of attempts) {
      const { headers, next } = run({ ...spoofed, ...extra }, { required: true, token: TOKEN });
      expect(headers['x-tenant-host']).toBeUndefined();
      expect(headers['x-forwarded-host']).toBeUndefined();
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it('keeps them with the right token', () => {
    const { headers } = run(
      { ...spoofed, 'x-internal-token': TOKEN },
      { required: true, token: TOKEN },
    );
    expect(headers['x-tenant-host']).toBe('victim.example.com');
    expect(headers['x-forwarded-host']).toBe('victim.example.com');
  });

  it('does nothing when not required', () => {
    const { headers } = run(spoofed, { required: false, token: '' });
    expect(headers['x-tenant-host']).toBe('victim.example.com');
  });

  it('never accepts an empty configured token, whatever is sent', () => {
    expect(hasValidProxyToken('', '')).toBe(false);
    expect(hasValidProxyToken(undefined, TOKEN)).toBe(false);
    expect(hasValidProxyToken(['a', 'b'], TOKEN)).toBe(false);
    expect(hasValidProxyToken('short', TOKEN)).toBe(false);
    expect(hasValidProxyToken(TOKEN, TOKEN)).toBe(true);
  });
});

describe('helmet options', () => {
  it('locks the API down in production', () => {
    const csp = helmetOptions(true).contentSecurityPolicy;
    expect(csp).toMatchObject({
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    });
  });

  it('leaves CSP off in development for Swagger', () => {
    expect(helmetOptions(false).contentSecurityPolicy).toBe(false);
  });
});
