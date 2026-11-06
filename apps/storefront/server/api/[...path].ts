/**
 * پروکسی هم‌مبدأ برای درخواست‌های مرورگر به API.
 * - خواندن (GET/HEAD): فقط /api/store و /api/storefront
 * - نوشتن: فقط چند مسیر مشخص (OTP و نشست، سبد، پروفایل مشتری)
 * - tenant از Host واقعی درخواست ساخته می‌شود، نه از هدری که کلاینت فرستاده
 * - کوکی‌ها و Set-Cookie بدون تغییر عبور می‌کنند (host-only روی دامنه‌ی خود فروشگاه)
 */
const READ_PREFIXES = ['/api/store', '/api/storefront'];

const WRITE_RULES: Array<{ prefix: string; methods: string[] }> = [
  { prefix: '/api/storefront/auth', methods: ['POST'] },
  { prefix: '/api/storefront/cart', methods: ['POST', 'PATCH', 'DELETE'] },
  { prefix: '/api/storefront/customer', methods: ['PATCH'] },
  { prefix: '/api/storefront/addresses', methods: ['POST', 'PATCH', 'DELETE'] },
  { prefix: '/api/storefront/orders', methods: ['POST'] },
  { prefix: '/api/storefront/payments', methods: ['POST'] },
];

const SAFE_METHODS = new Set(['GET', 'HEAD']);

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export default defineEventHandler(async (event) => {
  // pathname نرمال‌شده است (مثلاً /api/storefront/../auth به /api/auth تبدیل می‌شود و رد می‌شود)
  const url = getRequestURL(event);
  const config = useRuntimeConfig(event);
  const trust = Boolean(config.trustProxy);
  const host = getRequestHost(event, { xForwardedHost: trust });

  if (SAFE_METHODS.has(event.method)) {
    if (!READ_PREFIXES.some((p) => under(url.pathname, p))) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' });
    }
  } else {
    const rule = WRITE_RULES.find((r) => under(url.pathname, r.prefix));
    if (!rule) throw createError({ statusCode: 404, statusMessage: 'Not Found' });
    if (!rule.methods.includes(event.method)) {
      throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
    }

    // دفاع در برابر CSRF (علاوه بر SameSite=Lax): درخواست نوشتن باید از همین دامنه آمده باشد
    const origin = getRequestHeader(event, 'origin');
    if (origin) {
      let originHost = '';
      try {
        originHost = new URL(origin).host;
      } catch {
        // origin نامعتبر
      }
      if (originHost !== host) throw createError({ statusCode: 403, statusMessage: 'Bad Origin' });
    }
    if (getRequestHeader(event, 'sec-fetch-site') === 'cross-site') {
      throw createError({ statusCode: 403, statusMessage: 'Cross-site request' });
    }

    // فرم‌های ساده‌ی cross-site نمی‌توانند application/json بفرستند
    const contentType = getRequestHeader(event, 'content-type');
    if (contentType && !contentType.toLowerCase().startsWith('application/json')) {
      throw createError({ statusCode: 415, statusMessage: 'Unsupported Media Type' });
    }
  }

  const ip = getRequestIP(event, { xForwardedFor: trust });

  try {
    return await proxyRequest(event, `${config.apiOrigin}${url.pathname}${url.search}`, {
      headers: {
        'x-tenant-host': host,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(config.internalApiToken ? { 'x-internal-token': String(config.internalApiToken) } : {}),
      },
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Bad Gateway' });
  }
});
