import { isPlatformHost } from '../utils/platform';

/**
 * تشخیص می‌دهد که آیا هاست جاری مربوط به پلتفرم اصلی (سایت‌ساز سازینو) است
 * یا یک فروشگاه مستأجر (ساب‌دامین مانند demo.localhost یا دامنه‌ی اختصاصی).
 */
export function useIsPlatform(): ComputedRef<boolean> {
  const config = useRuntimeConfig();
  const trust = Boolean(config.trustProxy);
  const url = useRequestURL({ xForwardedHost: trust });

  return computed(() => {
    return isPlatformHost(url.host, config.public.platformDomain as string);
  });
}

/** آدرس پنل مدیریت و ثبت‌نام فروشندگان */
export function useDashboardUrl(): string {
  const config = useRuntimeConfig();
  return (config.public.dashboardUrl as string) || 'http://localhost:3001';
}
