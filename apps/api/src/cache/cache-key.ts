import { createHash } from 'node:crypto';

export const CACHE_KEY_PREFIX = 'sfcache:';
export const CACHE_VERSION_PREFIX = 'sfcache:ver:';

/**
 * فقط خواندن‌های عمومی و غیرشخصی. فهرست سفید عمداً دقیق است:
 * سبد، مشتری، سفارش، آدرس، checkout و نشست زیر /api/storefront هستند ولی هرگز کش نمی‌شوند.
 */
const CACHEABLE_PATHS: readonly RegExp[] = [
  /^\/api\/store$/,
  /^\/api\/storefront\/(?:products|categories)$/,
  /^\/api\/storefront\/(?:products|categories)\/[^/]+$/,
  /^\/api\/storefront\/pages\/[^/]+$/,
  /^\/api\/storefront\/sitemap-urls$/,
];

/** پارامترهای query فهرست محصولات (page، limit، q، categorySlug، sort)؛ هر چیز دیگر (مثل preview) = بدون کش */
export const CACHEABLE_QUERY_KEYS = ['page', 'limit', 'q', 'categorySlug', 'sort'] as const;
export const MAX_QUERY_VALUE_LENGTH = 100;

function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

export function isCacheablePath(path: string): boolean {
  const p = normalizePath(path);
  return CACHEABLE_PATHS.some((re) => re.test(p));
}

/** query را مرتب و استاندارد می‌کند؛ ناشناخته، بلند یا غیررشته‌ای = null */
export function canonicalQuery(query: Record<string, unknown>): string | null {
  const keys = Object.keys(query);
  if (keys.length > CACHEABLE_QUERY_KEYS.length) return null;
  const allowed = CACHEABLE_QUERY_KEYS as readonly string[];
  const pairs: string[] = [];
  for (const key of keys.sort()) {
    if (!allowed.includes(key)) return null;
    const value = query[key];
    if (typeof value !== 'string' || value.length > MAX_QUERY_VALUE_LENGTH) return null;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  return pairs.join('&');
}

export function buildCacheKey(input: {
  tenantId: string;
  version: string;
  path: string;
  query: Record<string, unknown>;
}): string | null {
  if (!isCacheablePath(input.path)) return null;
  const query = canonicalQuery(input.query);
  if (query === null) return null;
  const hash = createHash('sha256')
    .update(`${normalizePath(input.path)}?${query}`)
    .digest('hex')
    .slice(0, 32);
  return `${CACHE_KEY_PREFIX}${input.tenantId}:${input.version}:${hash}`;
}