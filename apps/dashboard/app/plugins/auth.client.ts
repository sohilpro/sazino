export default defineNuxtPlugin(async () => {
  // مسیر سوپر ادمین به نشست فروشنده ربطی ندارد
  if (window.location.pathname.startsWith('/admin')) return;
  // بعد از رفرش صفحه، نشست را از روی کوکی refresh برمی‌گرداند (قبل از اجرای middlewareها)
  await useAuth().refresh();
});