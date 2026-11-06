/** آدرس مطلق برای canonical، og:url و JSON-LD: دامنه‌ی اصلی فروشگاه، وگرنه Host واقعی درخواست */
export function useSiteUrl() {
  const config = useRuntimeConfig();
  const store = useStore();
  const url = useRequestURL({ xForwardedHost: Boolean(config.trustProxy) });
  return (path = '/') => `${store.value?.canonicalUrl ?? url.origin}${path}`;
}