/** آدرس مطلق ساز بر اساس Host واقعی درخواست (برای canonical، og:url و JSON-LD) */
export function useSiteUrl() {
  const config = useRuntimeConfig();
  const url = useRequestURL({ xForwardedHost: Boolean(config.trustProxy) });
  return (path = '/') => `${url.origin}${path}`;
}