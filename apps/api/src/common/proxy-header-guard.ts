import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const PROXY_TOKEN_HEADER = 'x-internal-token';
/** هدرهایی که فقط پروکسی مورد اعتماد مجاز است بفرستد */
export const PROXY_HOST_HEADERS = ['x-tenant-host', 'x-forwarded-host'] as const;

const digest = (value: string) => createHash('sha256').update(value).digest();

export function hasValidProxyToken(header: string | string[] | undefined, token: string): boolean {
  if (typeof header !== 'string' || token === '') return false;
  return timingSafeEqual(digest(header), digest(token));
}

/**
 * وقتی required است و توکن درست نیامده، هدرهای تعیین‌کننده‌ی tenant را پاک می‌کند
 * تا resolver فقط به Host واقعی تکیه کند. درخواست را رد نمی‌کند (API پنل هم از همین راه می‌آید).
 */
export function createProxyHeaderGuard(opts: { required: boolean; token: string }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (opts.required && !hasValidProxyToken(req.headers[PROXY_TOKEN_HEADER], opts.token)) {
      for (const header of PROXY_HOST_HEADERS) delete req.headers[header];
    }
    next();
  };
}