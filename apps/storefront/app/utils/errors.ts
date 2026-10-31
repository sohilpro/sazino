/**
 * ۴۰۴ سمت سرور fatal نیست تا ۴۰۴ عادی (ربات‌ها، لینک قدیمی) در لاگ ثبت نشود؛
 * سمت مرورگر باید fatal باشد تا صفحه‌ی خطا نمایش داده شود.
 */
export function notFoundError(statusMessage = 'Not Found') {
  return createError({ statusCode: 404, statusMessage, fatal: import.meta.client });
}

/** خطای API برای صفحه: ۴۰۴ و ۴۱۰ (پیوند پیش‌نمایش منقضی) همان وضعیت، هر چیز دیگر ← ۵۰۲ */
export function pageError(err: unknown) {
  const status = statusOf(err);
  if (status === 404) return notFoundError();
  if (status === 410) {
    return createError({ statusCode: 410, statusMessage: 'Preview Expired', fatal: import.meta.client });
  }
  return createError({ statusCode: 502, statusMessage: 'Bad Gateway', fatal: true });
}