import type { IncomingHttpHeaders } from 'node:http';

const HOST_REGEX = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const IPV4_REGEX = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export function firstHeader(value: string | string[] | undefined): string | undefined {
  const v = (Array.isArray(value) ? value[0] : value)?.trim();
  return v ? v : undefined;
}

/** Host خام را به شکل استاندارد درمی‌آورد؛ برای مقدار نامعتبر null برمی‌گرداند */
export function normalizeHost(raw: string | undefined): string | null {
  const first = raw?.split(',')[0]?.trim().toLowerCase();
  if (!first || first.startsWith('[')) return null; // IPv6
  const host = first.replace(/:\d{1,5}$/, '').replace(/\.$/, '');
  if (host.length === 0 || host.length > 253) return null;
  if (host.includes('..') || !HOST_REGEX.test(host)) return null;
  return host;
}

export function isIpv4(host: string): boolean {
  return IPV4_REGEX.test(host);
}

/** همان ترتیب TenantMiddleware: x-tenant-host، بعد x-forwarded-host، بعد Host (با پورت) */
export function requestHost(headers: IncomingHttpHeaders): string | undefined {
  return (
    firstHeader(headers['x-tenant-host']) ??
    firstHeader(headers['x-forwarded-host']) ??
    headers.host
  );
}
