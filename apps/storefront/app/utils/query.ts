import type { LocationQuery, LocationQueryRaw } from 'vue-router';

export function firstQuery(value: unknown): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v : '';
}

/** query فعلی را با تغییرات ادغام می‌کند؛ مقدار undefined یا خالی، کلید را حذف می‌کند */
export function mergeQuery(
  current: LocationQuery,
  patch: Record<string, string | number | undefined>,
): LocationQueryRaw {
  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') delete next[key];
    else next[key] = String(value);
  }
  return next as LocationQueryRaw;
}