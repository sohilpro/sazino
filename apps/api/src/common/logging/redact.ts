import { maskPhone } from '../phone';

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY =
  /(password|passwd|secret|token|authorization|cookie|api[-_]?key|merchant|encryption|dsn)|^otp$/i;
const PHONE = /(?<!\d)09\d{9}(?!\d)/g;
const MAX_DEPTH = 5;

/** شماره‌ی موبایل داخل متن را ماسک می‌کند (0912***6789) */
export function maskPhones(text: string): string {
  return text.replace(PHONE, (match) => maskPhone(match));
}

/** کپی امن برای لاگ: کلیدهای حساس پاک، موبایل‌ها ماسک، عمق محدود */
export function redactValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return maskPhones(value);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: maskPhones(value.message) };
  if (depth >= MAX_DEPTH) return '[Truncated]';
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(item, depth + 1);
  }
  return out;
}