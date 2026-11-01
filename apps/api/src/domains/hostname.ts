import { domainToASCII } from 'node:url';

/** TLDهای ویژه/رزروشده که هرگز دامنه‌ی عمومی نیستند */
const RESERVED_TLDS = new Set([
  'localhost',
  'local',
  'internal',
  'invalid',
  'test',
  'example',
  'onion',
  'lan',
  'home',
  'corp',
  'intranet',
  'arpa',
]);

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

export type HostnameResult =
  | { ok: true; hostname: string }
  | { ok: false; reason: 'invalid' | 'ip' | 'reserved' | 'platform' };

export const HOSTNAME_ERROR_MESSAGE: Record<Extract<HostnameResult, { ok: false }>['reason'], string> = {
  invalid: 'نام دامنه نامعتبر است (مثال: shop.example.com)',
  ip: 'آدرس IP پذیرفته نمی‌شود؛ نام دامنه را وارد کنید',
  reserved: 'این پسوند دامنه (مثل .test یا .local) قابل استفاده نیست',
  platform: 'دامنه‌های خود پلتفرم را نمی‌توانید به‌عنوان دامنه‌ی اختصاصی ثبت کنید',
};

/**
 * ورودی کاربر را به نام دامنه‌ی استاندارد (lowercase و punycode) تبدیل می‌کند.
 * اگر آدرس کامل (https://…/path) چسبانده شده باشد فقط نام دامنه برداشته می‌شود.
 */
export function normalizeCustomHostname(input: string, platformDomain: string): HostnameResult {
  const value = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');

  if (!value) return { ok: false, reason: 'invalid' };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value) || value.includes(':') || value.startsWith('[')) {
    return { ok: false, reason: 'ip' };
  }

  const ascii = domainToASCII(value);
  if (!ascii || ascii.length > 253) return { ok: false, reason: 'invalid' };

  const labels = ascii.split('.');
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label))) {
    return { ok: false, reason: 'invalid' };
  }

  const tld = labels[labels.length - 1]!;
  if (!TLD.test(tld)) return { ok: false, reason: 'invalid' };
  if (RESERVED_TLDS.has(tld)) return { ok: false, reason: 'reserved' };

  const platform = platformDomain.toLowerCase();
  if (ascii === platform || ascii.endsWith(`.${platform}`)) return { ok: false, reason: 'platform' };

  return { ok: true, hostname: ascii };
}

export function parseList(csv: string | undefined): string[] {
  return (csv ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}