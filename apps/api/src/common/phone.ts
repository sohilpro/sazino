const DIGITS = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';

export const PHONE_REGEX = /^09\d{9}$/;

/** ارقام فارسی و عربی را لاتین می‌کند */
export function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => String(DIGITS.indexOf(d) % 10));
}

/** هر قالب رایج موبایل ایران را به 09xxxxxxxxx تبدیل می‌کند؛ نامعتبر = null */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;

  let s = normalizeDigits(input).replace(/[\s\-()]/g, '');
  if (s.startsWith('+98')) s = s.slice(3);
  else if (s.startsWith('0098')) s = s.slice(4);
  else if (s.startsWith('98') && s.length === 12) s = s.slice(2);
  if (/^9\d{9}$/.test(s)) s = `0${s}`;

  return PHONE_REGEX.test(s) ? s : null;
}

/** برای لاگ: 0912***4567 */
export const maskPhone = (phone: string) => `${phone.slice(0, 4)}***${phone.slice(-4)}`;