/**
 * ۴۰۴ سمت سرور fatal نیست تا ۴۰۴ عادی (ربات‌ها، لینک قدیمی) در لاگ ثبت نشود؛
 * سمت مرورگر باید fatal باشد تا صفحه‌ی خطا نمایش داده شود.
 */
export function notFoundError(statusMessage = 'Not Found') {
  return createError({ statusCode: 404, statusMessage, fatal: import.meta.client });
}