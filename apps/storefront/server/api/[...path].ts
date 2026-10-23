/**
 * پروکسی هم‌مبدأ برای درخواست‌های مرورگر به API.
 * - فقط GET/HEAD و فقط endpointهای عمومی ویترین
 * - tenant از Host واقعی درخواست ساخته می‌شود، نه از هدری که کلاینت فرستاده
 */
const ALLOWED_PREFIXES = ['/api/store', '/api/storefront'];
const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

export default defineEventHandler(async (event) => {
  if (!ALLOWED_METHODS.has(event.method)) {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  // pathname نرمال‌شده است (مثلاً /api/storefront/../auth به /api/auth تبدیل می‌شود و رد می‌شود)
  const url = getRequestURL(event);
  const allowed = ALLOWED_PREFIXES.some(
    (p) => url.pathname === p || url.pathname.startsWith(`${p}/`),
  );
  if (!allowed) throw createError({ statusCode: 404, statusMessage: 'Not Found' });

  const config = useRuntimeConfig(event);
  const trust = Boolean(config.trustProxy);
  const host = getRequestHost(event, { xForwardedHost: trust });
  const ip = getRequestIP(event, { xForwardedFor: trust });

  try {
    return await proxyRequest(event, `${config.apiOrigin}${url.pathname}${url.search}`, {
      headers: {
        'x-tenant-host': host,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
      },
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Bad Gateway' });
  }
});