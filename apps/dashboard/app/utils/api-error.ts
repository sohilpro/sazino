export function statusOf(err: unknown): number | undefined {
  const e = err as { statusCode?: number; status?: number } | null;
  return e?.statusCode ?? e?.status;
}

/** پیام خطای قابل‌نمایش برای کاربر از روی پاسخ API */
export function apiErrorMessage(err: unknown, fallback = 'خطایی رخ داد؛ دوباره تلاش کنید'): string {
  const status = statusOf(err);
  if (status === 429) return 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید';
  if (status === 413) return 'حجم فایل بیش از حد مجاز است (حداکثر ۵ مگابایت)';
  if (status === 403) return 'شما به این بخش دسترسی ندارید';

  const message = (err as { data?: { message?: string | string[] } } | null)?.data?.message;
  if (Array.isArray(message) && message.length) return message.join('، ');
  if (typeof message === 'string' && message) return message;

  if (status === undefined) return 'ارتباط با سرور برقرار نشد';
  return fallback;
}