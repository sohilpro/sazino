import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()], server: { allowedHosts: true } },
  runtimeConfig: {
    // فقط سمت سرور. در پروداکشن با NUXT_API_ORIGIN مقداردهی می‌شود (مثلاً http://api:4000)
    apiOrigin: 'http://localhost:4000',
    // فقط پشت reverse proxy مورد اعتماد true شود (NUXT_TRUST_PROXY=true)
    trustProxy: false,
  },
  app: {
    head: {
      title: 'فروشگاه',
      htmlAttrs: { lang: 'fa', dir: 'rtl' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
});
