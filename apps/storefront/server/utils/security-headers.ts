export interface SecurityHeaderOptions {
  /** originهای اضافه برای connect-src (مثلاً API پنل) */
  connectOrigins?: string[];
  mediaOrigin?: string;
  allowBlobImages?: boolean;
}

/** فقط origin معتبر http(s) را برمی‌گرداند؛ جلوگیری از تزریق به هدر. */
export function toOrigin(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : '';
  } catch {
    return '';
  }
}

export function buildCsp(options: SecurityHeaderOptions = {}): string {
  const media = toOrigin(options.mediaOrigin);
  const connect = (options.connectOrigins ?? []).map(toOrigin).filter(Boolean);
  const img = ["'self'", 'data:', ...(options.allowBlobImages ? ['blob:'] : []), ...(media ? [media] : [])];
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${["'self'", ...connect].join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function securityHeaders(options: SecurityHeaderOptions = {}): Record<string, string> {
  return {
    'content-security-policy': buildCsp(options),
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  };
}