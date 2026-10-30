/**
 * ۴۰۴ سمت سرور fatal نیست تا ۴۰۴ عادی (ربات‌ها، لینک قدیمی) در لاگ ثبت نشود؛
 * سمت مرورگر باید fatal باشد تا صفحه‌ی خطا نمایش داده شود.
 */
export function notFoundError(statusMessage = 'Not Found') {
  return createError({ statusCode: 404, statusMessage, fatal: import.meta.client });
}

/** خطای API برای صفحه: ۴۰۴ ← صفحه‌ی ۴۰۴، هر چیز دیگر ← ۵۰۲ */
export function pageError(err: unknown) {
  return statusOf(err) === 404
    ? notFoundError()
    : createError({ statusCode: 502, statusMessage: 'Bad Gateway', fatal: true });
}