import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/fonts'],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  fonts: { families: [{ name: 'Vazirmatn', provider: 'google' }] },
  runtimeConfig: {
    public: {
      // با NUXT_PUBLIC_API_BASE در پروداکشن override می‌شود
      apiBase: 'http://localhost:4000/api',
    },
  },
  app: {
    head: {
      title: 'فروشگاه',
      htmlAttrs: { lang: 'fa', dir: 'rtl' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
});