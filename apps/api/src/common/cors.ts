/**
 * فهرست originهای مجاز CORS را اعتبارسنجی می‌کند.
 * ممنوع: wildcard، مسیر/query/credentials/اسلش انتهایی، http در پروداکشن، فهرست خالی در پروداکشن.
 */
export function parseCorsOrigins(raw: string | undefined, opts: { production: boolean }): string[] {
  const items = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (items.length === 0) {
    if (opts.production) throw new Error('CORS_ORIGINS must list at least one origin in production');
    return [];
  }

  const result = new Set<string>();
  for (const item of items) {
    if (item.includes('*')) throw new Error(`CORS origin must not contain a wildcard: ${item}`);

    let url: URL;
    try {
      url = new URL(item);
    } catch {
      throw new Error(`CORS origin is not a valid URL: ${item}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`CORS origin must use http or https: ${item}`);
    }
    // origin فقط scheme+host+port است؛ هر چیز اضافه (مسیر، query، credentials، اسلش) با آن نمی‌خواند
    if (url.origin !== item) {
      throw new Error(`CORS origin must be a bare origin (no path, query, credentials or trailing slash): ${item}`);
    }
    if (opts.production && url.protocol !== 'https:') {
      throw new Error(`CORS origin must use https in production: ${item}`);
    }
    result.add(item);
  }
  return [...result];
}

type OriginCallback = (err: Error | null, allow?: boolean) => void;

/** درخواست بدون Origin (curl، سرور به سرور) آزاد است؛ origin ناشناخته بدون هدر CORS رد می‌شود. */
export function corsOriginCallback(allowed: readonly string[]) {
  const set = new Set(allowed);
  return (origin: string | undefined, callback: OriginCallback): void => {
    if (!origin) return callback(null, true);
    callback(null, set.has(origin));
  };
}