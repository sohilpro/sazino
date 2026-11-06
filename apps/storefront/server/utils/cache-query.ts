export function isCachedStorefrontPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/products/') ||
    pathname.startsWith('/categories/') ||
    pathname.startsWith('/p/')
  );
}

/**
 * برای مسیرهای کش‌شونده فقط page و sort (با مقدار معتبر) می‌مانند.
 * ریدایرکت نمی‌کنیم؛ فقط آدرس داخلی را بازنویسی می‌کنیم تا کلید کش نرمال شود.
 */
export function normalizeCachedUrl(url: string): string {
  const i = url.indexOf('?');
  const pathname = i === -1 ? url : url.slice(0, i);
  if (!isCachedStorefrontPath(pathname)) return url;

  const params = new URLSearchParams(i === -1 ? '' : url.slice(i + 1));
  const kept = new URLSearchParams();
  const page = params.get('page');
  if (page && /^[1-9]\d{0,3}$/.test(page)) kept.set('page', page);
  const sort = params.get('sort');
  if (sort && /^[a-z0-9_-]{1,32}$/i.test(sort)) kept.set('sort', sort);

  const query = kept.toString();
  return query ? `${pathname}?${query}` : pathname;
}