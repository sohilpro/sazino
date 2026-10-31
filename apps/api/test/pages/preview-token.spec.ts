import { PREVIEW_TTL_MS, PreviewTokenService } from '../../src/pages/preview-token.service';

const make = (secret = 's'.repeat(40)) => new PreviewTokenService({ get: () => secret } as never);
const where = { tenantId: 'tenant-1', slug: 'about' };

describe('PreviewTokenService', () => {
  const svc = make();

  it('round-trips and expires after 30 minutes', () => {
    const now = 1_000_000;
    const { token, expiresAt } = svc.sign(where.tenantId, where.slug, PREVIEW_TTL_MS, now);

    expect(expiresAt.getTime()).toBe(now + 30 * 60_000);
    expect(svc.verify(token, where, now + 1000)).toBe(true);
    expect(svc.verify(token, where, now + PREVIEW_TTL_MS - 1)).toBe(true);
    expect(svc.verify(token, where, now + PREVIEW_TTL_MS)).toBe(false);
  });

  it('is bound to its tenant and slug', () => {
    const { token } = svc.sign(where.tenantId, where.slug);
    expect(svc.verify(token, { ...where, slug: 'home' })).toBe(false);
    expect(svc.verify(token, { ...where, tenantId: 'tenant-2' })).toBe(false);
  });

  it('rejects an already expired token', () => {
    const { token } = svc.sign(where.tenantId, where.slug, -1000);
    expect(svc.verify(token, where)).toBe(false);
  });

  it('rejects tampered claims even with a valid-looking body', () => {
    const { token } = svc.sign(where.tenantId, where.slug);
    const [, mac] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ v: 1, t: where.tenantId, s: 'home', e: Date.now() + 10 * PREVIEW_TTL_MS }),
    ).toString('base64url');

    expect(svc.verify(`${forged}.${mac}`, { ...where, slug: 'home' })).toBe(false);
    expect(svc.verify(`${token}x`, where)).toBe(false);
  });

  it('rejects malformed input', () => {
    for (const token of ['', 'a', 'a.b', 'a.b.c', '.', '..', 'not a token']) {
      expect(svc.verify(token, where)).toBe(false);
    }
  });

  it('rejects tokens signed with another secret', () => {
    const { token } = make('x'.repeat(40)).sign(where.tenantId, where.slug);
    expect(svc.verify(token, where)).toBe(false);
  });
});