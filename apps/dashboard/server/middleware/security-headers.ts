import { securityHeaders } from '../utils/security-headers';

export default defineEventHandler((event) => {
  if (import.meta.dev) return;
  const config = useRuntimeConfig(event);
  setResponseHeaders(
    event,
    securityHeaders({
      mediaOrigin: String(config.mediaOrigin ?? ''),
      connectOrigins: [String(config.public.apiBase ?? '')],
      allowBlobImages: true,
    }),
  );
});