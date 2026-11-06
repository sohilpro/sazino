import { getRequestIP } from 'h3';

type Primitive = string | number | boolean | null | undefined;

interface ApiOptions {
  query?: Record<string, Primitive>;
}

/**
 * کلاینت API ویترین؛ مسیرها بدون پیشوند /api نوشته می‌شوند (مثلاً '/storefront/products').
 * - سمت سرور: مستقیم به API با x-tenant-host، توکن داخلی و IP واقعی بازدیدکننده
 * - سمت مرورگر: از پروکسی هم‌مبدأ Nitro (بدون CORS و با کوکی‌های همین دامنه)
 * باید داخل setup/middleware فراخوانی شود.
 */
export function useStorefrontApi() {
  const config = useRuntimeConfig();
  const trust = Boolean(config.trustProxy);
  const host = useRequestURL({ xForwardedHost: trust }).host;

  const serverHeaders: Record<string, string> = {};
  if (import.meta.server) {
    serverHeaders['x-tenant-host'] = host;
    const event = useRequestEvent();
    const ip = event ? getRequestIP(event, { xForwardedFor: trust }) : undefined;
    if (ip) serverHeaders['x-forwarded-for'] = ip;
    if (config.internalApiToken)
      serverHeaders['x-internal-token'] = String(config.internalApiToken);
  }

  return function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
    const query = opts.query
      ? Object.fromEntries(
          Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
        )
      : undefined;

    if (import.meta.server) {
      return $fetch<T>(`${config.apiOrigin}/api${path}`, { query, headers: serverHeaders });
    }
    return $fetch<T>(`/api${path}`, { query });
  };
}
