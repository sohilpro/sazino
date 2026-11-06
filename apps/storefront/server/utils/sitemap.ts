export const MAX_SITEMAP_URLS = 45_000;

export const ROBOTS_DISALLOW = [
  '/cart',
  '/checkout',
  '/account',
  '/orders',
  '/login',
  '/payment',
  '/api',
  '/dev',
  '/preview',
] as const;

const ENTITIES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
};

export function xmlEscape(value: string): string {
  return (
    value
      // کاراکترهای کنترلی در XML 1.0 مجاز نیستند
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/[<>&'"]/g, (c) => ENTITIES[c] ?? c)
  );
}

export function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function buildSitemapXml(
  origin: string,
  entries: ReadonlyArray<{ path: string; lastModified: string | null }>,
): string {
  const base = origin.replace(/\/+$/, '');
  const rows = entries.slice(0, MAX_SITEMAP_URLS).map((entry) => {
    const loc = xmlEscape(`${base}${encodePath(entry.path)}`);
    const time = entry.lastModified ? Date.parse(entry.lastModified) : Number.NaN;
    const lastmod = Number.isNaN(time) ? '' : `<lastmod>${new Date(time).toISOString()}</lastmod>`;
    return `  <url><loc>${loc}</loc>${lastmod}</url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows,
    '</urlset>',
    '',
  ].join('\n');
}

/** origin = null یعنی فروشگاه ناشناخته/معلق: همه‌چیز بسته. */
export function buildRobotsTxt(opts: { origin: string | null }): string {
  if (opts.origin === null) return 'User-agent: *\nDisallow: /\n';
  const origin = opts.origin.replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    ...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}