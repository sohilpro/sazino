/* eslint-disable no-control-regex */

/**
 * فقط دو نوع لینک مجاز است:
 *  - مسیر داخلی: با یک «/» شروع شود (نه «//»)، بدون فاصله، بک‌اسلش و کاراکتر کنترلی
 *  - https:// بدون نام‌کاربری و رمز
 * (javascript:، data:، http: و //evil.com همگی رد می‌شوند)
 */
export function isSafeHref(href: string): boolean {
  if (href.length === 0 || href.length > 500) return false;

  if (/^\/(?!\/)[^\s\\\u0000-\u001f]*$/.test(href)) return true;

  if (!/^https:\/\/[^\s\u0000-\u001f]+$/.test(href)) return false;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}