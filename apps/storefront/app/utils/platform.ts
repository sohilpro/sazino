/**
 * بررسی می‌کند که آیا هاست ورودی مربوط به دامنه‌ی اصلی پلتفرم (سایت‌ساز سازینو) است
 * یا یک فروشگاه مستأجر (مانند demo.localhost یا دامنه‌ی اختصاصی).
 */
export function isPlatformHost(
  rawHost: string | undefined,
  platformDomain: string = 'localhost',
): boolean {
  if (!rawHost) return true;
  const firstPart = rawHost.split(':')[0] ?? '';
  const host = firstPart.trim().toLowerCase().replace(/\.$/, '');
  if (!host) return true;

  const domainPart = platformDomain.replace(/:\d+$/, '').replace(/\.$/, '').trim();
  const domain = domainPart.toLowerCase() || 'localhost';

  // ۱) تطابق مستقیم با دامنه‌ی اصلی پلتفرم (مثلاً localhost یا sazino.ir)
  if (host === domain) return true;

  // ۲) آدرس IP (مثلاً 127.0.0.1)
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;

  // ۳) نام‌های تک‌بخشی بدون نقطه (مانند localhost یا نام سرویس در داکر)
  if (!host.includes('.')) return true;

  // ۴) پیشوند www روی دامنه‌ی پلتفرم (مثلاً www.sazino.ir یا www.localhost)
  if (host === `www.${domain}`) return true;

  // ۵) ساب‌دامین‌های رزروشده برای پلتفرم
  if (host.endsWith(`.${domain}`)) {
    const sub = host.slice(0, -(domain.length + 1));
    if (['www', 'app', 'api', 'admin', 'dashboard', 'media'].includes(sub)) {
      return true;
    }
  }

  return false;
}
