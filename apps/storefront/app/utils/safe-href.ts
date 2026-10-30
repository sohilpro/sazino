/* eslint-disable no-control-regex */

/** دفاع دوم (اولی در API است): فقط مسیر داخلی یا https. هر چیز دیگر ← null */
export function safeHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const value = href.trim();
  if (value.length === 0 || value.length > 500) return null;

  if (/^\/(?!\/)[^\s\\\u0000-\u001f]*$/.test(value)) return value;

  if (!/^https:\/\/[^\s\u0000-\u001f]+$/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}