import { maskPhones } from './logging/redact';

export interface SentryEventLike {
  request?: { url?: string; method?: string; headers?: Record<string, unknown> };
  user?: { id?: unknown };
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: Array<{ message?: string; data?: unknown }>;
  extra?: unknown;
}

const KEEP_HEADERS = ['user-agent', 'content-type', 'accept', 'x-request-id'];

/**
 * پیش از ارسال به Sentry: کوکی، Authorization، بدن، query، IP و ایمیل حذف می‌شوند و
 * موبایل‌ها ماسک می‌شوند. فقط داده‌ی لازم برای ردیابی می‌ماند.
 */
export function scrubSentryEvent<T extends SentryEventLike>(event: T): T {
  const out: SentryEventLike = { ...event };

  if (event.request) {
    const headers = Object.fromEntries(
      Object.entries(event.request.headers ?? {}).filter(([key]) =>
        KEEP_HEADERS.includes(key.toLowerCase()),
      ),
    );
    out.request = {
      method: event.request.method,
      url: event.request.url?.split('?')[0],
      headers,
    };
  }

  out.user = event.user?.id !== undefined ? { id: event.user.id } : undefined;
  out.extra = undefined;

  if (typeof event.message === 'string') out.message = maskPhones(event.message);
  if (event.exception?.values) {
    out.exception = {
      ...event.exception,
      values: event.exception.values.map((v) => ({
        ...v,
        value: typeof v.value === 'string' ? maskPhones(v.value) : v.value,
      })),
    };
  }
  if (event.breadcrumbs) {
    out.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: typeof b.message === 'string' ? maskPhones(b.message) : b.message,
      data: undefined,
    }));
  }
  return out as T;
}