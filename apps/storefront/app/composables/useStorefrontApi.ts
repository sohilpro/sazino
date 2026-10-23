type Primitive = string | number | boolean | null | undefined;

interface ApiOptions {
  query?: Record<string, Primitive>;
}

/**
 * کلاینت API ویترین؛ مسیرها بدون پیشوند /api نوشته می‌شوند (مثلاً '/storefront/products').
 * - سمت سرور: مستقیم به API با هدر x-tenant-host (برگرفته از Host درخواست)
 * - سمت مرورگر: از پروکسی هم‌مبدأ Nitro (بدون CORS و با کوکی‌های همین دامنه)
 * باید داخل setup/middleware فراخوانی شود.
 */
export function useStorefrontApi() {
  const config = useRuntimeConfig();
  const host = useRequestURL({ xForwardedHost: Boolean(config.trustProxy) }).host;

  return function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
    const query = opts.query
      ? Object.fromEntries(
          Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
        )
      : undefined;

    if (import.meta.server) {
      return $fetch<T>(`${config.apiOrigin}/api${path}`, {
        query,
        headers: { 'x-tenant-host': host },
      });
    }
    return $fetch<T>(`/api${path}`, { query });
  };
}