export default defineNuxtPlugin(async () => {
  // بعد از رفرش صفحه، نشست را از روی کوکی refresh برمی‌گرداند (قبل از اجرای middlewareها)
  await useAuth().refresh();
});