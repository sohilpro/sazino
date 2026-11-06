import { getRequestHost, getRequestIP, type H3Event } from 'h3';

export function requestHost(event: H3Event): string {
  const config = useRuntimeConfig(event);
  return getRequestHost(event, { xForwardedHost: Boolean(config.trustProxy) });
}

/** هدرهایی که هویت فروشگاه و IP کلاینت را به API می‌رسانند. پروکسی /api هم باید از همین استفاده کند. */
export function upstreamIdentityHeaders(event: H3Event): Record<string, string> {
  const config = useRuntimeConfig(event);
  const headers: Record<string, string> = { 'x-tenant-host': requestHost(event) };
  const ip = getRequestIP(event, { xForwardedFor: Boolean(config.trustProxy) });
  if (ip) headers['x-forwarded-for'] = ip;
  if (config.internalApiToken) headers['x-internal-token'] = String(config.internalApiToken);
  return headers;
}

export async function apiFetch<T>(event: H3Event, path: string): Promise<T> {
  const config = useRuntimeConfig(event);
  return await $fetch<T>(`/api${path}`, {
    baseURL: String(config.apiOrigin),
    headers: { accept: 'application/json', ...upstreamIdentityHeaders(event) },
    timeout: 5000,
  });
}

export function upstreamStatus(error: unknown): number | undefined {
  const e = error as { statusCode?: number; status?: number } | null;
  return e?.statusCode ?? e?.status;
}