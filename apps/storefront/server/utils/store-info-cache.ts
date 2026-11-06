import type { H3Event } from 'h3';
import { apiFetch, requestHost } from './api';

const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;

const cache = new Map<string, { canonicalUrl: string | null; expires: number }>();

/** canonicalUrl فروشگاه با کش کوتاه حافظه؛ هر خطا یا فروشگاه ناشناخته = null. */
export async function getCanonicalUrl(event: H3Event): Promise<string | null> {
  const host = requestHost(event).toLowerCase();
  const hit = cache.get(host);
  if (hit && hit.expires > Date.now()) return hit.canonicalUrl;

  let canonicalUrl: string | null = null;
  try {
    canonicalUrl = (await apiFetch<{ canonicalUrl?: string }>(event, '/store')).canonicalUrl ?? null;
  } catch {
    canonicalUrl = null;
  }

  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(host, { canonicalUrl, expires: Date.now() + (canonicalUrl ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) });
  return canonicalUrl;
}