const SKIP_PREFIXES = ['/api', '/_nuxt', '/__nuxt', '/_ipx', '/dev'] as const;
const SKIP_EXACT = ['/sitemap.xml', '/robots.txt', '/favicon.ico'] as const;

export function shouldSkipCanonical(path: string): boolean {
  const pathname = path.split('?')[0] ?? '/';
  if ((SKIP_EXACT as readonly string[]).includes(pathname)) return true;
  return SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** آدرس ریدایرکت ۳۰۱ یا null اگر لازم نیست. query حفظ می‌شود. */
export function canonicalRedirectTarget(input: {
  host: string;
  path: string;
  canonicalUrl: string | null;
}): string | null {
  if (!input.canonicalUrl) return null;
  let canonical: URL;
  try {
    canonical = new URL(input.canonicalUrl);
  } catch {
    return null;
  }
  if (canonical.protocol !== 'http:' && canonical.protocol !== 'https:') return null;
  if (canonical.host.toLowerCase() === input.host.toLowerCase()) return null;
  if (!input.path.startsWith('/') || input.path.startsWith('//')) return null;
  return `${canonical.origin}${input.path}`;
}