import tailwindcss from '@tailwindcss/vite';

const isProd = process.env.NODE_ENV === 'production';
const htmlCache = { maxAge: 30, staleMaxAge: 60, swr: true, varies: ['host', 'x-forwarded-host'] };

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  // allowedHosts: دامنه‌های اختصاصی در توسعه رد نشوند (روز ۱۶)
  vite: { plugins: [tailwindcss()], server: { allowedHosts: true } },
  runtimeConfig: {
    // فقط سمت سرور. در پروداکشن با NUXT_API_ORIGIN مقداردهی می‌شود (مثلاً http://api:4000)
    apiOrigin: 'http://localhost:4000',
    // فقط پشت reverse proxy مورد اعتماد true شود (NUXT_TRUST_PROXY=true)
    trustProxy: false,
    // روز ۱۸ (همه با NUXT_ شروع می‌شوند)
    internalApiToken: '', // NUXT_INTERNAL_API_TOKEN، برابر INTERNAL_API_TOKEN در API
    canonicalRedirect: false, // NUXT_CANONICAL_REDIRECT
    mediaOrigin: '', // NUXT_MEDIA_ORIGIN
  },
  routeRules: {
    // کش HTML فقط در پروداکشن؛ لیست و جستجوی /products کش نمی‌شود
    ...(isProd
      ? {
          '/': { cache: htmlCache },
          '/products/**': { cache: htmlCache },
          '/categories/**': { cache: htmlCache },
          '/p/**': { cache: htmlCache },
          '/products': { cache: false },
        }
      : {}),
    '/preview': { headers: { 'cache-control': 'private, no-store' } },
    '/preview/**': { headers: { 'cache-control': 'private, no-store' } },
  },
  app: {
    head: {
      title: 'فروشگاه',
      htmlAttrs: { lang: 'fa', dir: 'rtl' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
});