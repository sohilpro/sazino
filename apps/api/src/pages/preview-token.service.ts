import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from '../config/env';

export const PREVIEW_TTL_MS = 30 * 60_000;

interface PreviewClaims {
  v: 1;
  /** tenantId */
  t: string;
  /** slug */
  s: string;
  /** انقضا (میلی‌ثانیه‌ی epoch) */
  e: number;
}

/**
 * توکن پیش‌نمایش: <claims>.<hmac>. به tenant و slug بسته است و فقط برای خواندن پیش‌نویس به کار می‌رود.
 * کلید آن از JWT_ACCESS_SECRET با برچسب جدا مشتق می‌شود، پس هرگز به‌جای توکن ورود پذیرفته نمی‌شود.
 */
@Injectable()
export class PreviewTokenService {
  private readonly key: Buffer;

  constructor(config: ConfigService<Env, true>) {
    this.key = createHmac('sha256', config.get('JWT_ACCESS_SECRET', { infer: true }))
      .update('page-preview-v1')
      .digest();
  }

  sign(tenantId: string, slug: string, ttlMs = PREVIEW_TTL_MS, now = Date.now()) {
    const claims: PreviewClaims = { v: 1, t: tenantId, s: slug, e: now + ttlMs };
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return { token: `${body}.${this.mac(body)}`, expiresAt: new Date(claims.e) };
  }

  verify(token: string, expected: { tenantId: string; slug: string }, now = Date.now()): boolean {
    const [body, mac, extra] = token.split('.');
    if (!body || !mac || extra !== undefined) return false;

    const given = Buffer.from(mac, 'base64url');
    const wanted = Buffer.from(this.mac(body), 'base64url');
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return false;

    let claims: Partial<PreviewClaims> | null;
    try {
      claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<PreviewClaims> | null;
    } catch {
      return false;
    }

    return (
      claims?.v === 1 &&
      claims.t === expected.tenantId &&
      claims.s === expected.slug &&
      typeof claims.e === 'number' &&
      claims.e > now
    );
  }

  private mac(body: string): string {
    return createHmac('sha256', this.key).update(body).digest('base64url');
  }
}