export function statusOf(err: unknown): number | undefined {
  const e = err as { statusCode?: number; status?: number } | null;
  return e?.statusCode ?? e?.status;
}

/** ثانیه‌ی انتظار در پاسخ ۴۲۹ سرویس OTP */
export function retryAfterOf(err: unknown): number | undefined {
  const v = (err as { data?: { retryAfter?: unknown } } | null)?.data?.retryAfter;
  return typeof v === 'number' ? v : undefined;
}

export function apiErrorMessage(err: unknown, fallback = 'خطایی رخ داد؛ دوباره تلاش کنید'): string {
  const status = statusOf(err);
  if (status === 429 && retryAfterOf(err) === undefined) {
    return 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید';
  }

  const message = (err as { data?: { message?: string | string[] } } | null)?.data?.message;
  if (Array.isArray(message) && message.length) return message.join('، ');
  if (typeof message === 'string' && message) return message;

  if (status === undefined) return 'ارتباط با سرور برقرار نشد';
  return fallback;
}

/** کد ماشین‌خوان خطای 409 (مثل PRICE_CHANGED) */
export function codeOf(err: unknown): string | undefined {
  const v = (err as { data?: { code?: unknown } } | null)?.data?.code;
  return typeof v === 'string' ? v : undefined;
}