import { defineConfig, devices } from '@playwright/test';

/**
 * مرورگر: در CI همان Chromium که Playwright نصب می‌کند.
 * محلی (cdn.playwright.dev از ایران مسدود است) از Edge نصب‌شده‌ی ویندوز استفاده می‌شود.
 * عوض‌کردن در cmd:  set E2E_CHANNEL=chrome   (یا msedge)
 * برای Chromium خود Playwright:  set E2E_CHANNEL=   (خالی)
 */
const channel = process.env.E2E_CHANNEL ?? (process.env.CI ? undefined : 'msedge');

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // *.localhost را فقط مرورگر می‌شناسد؛ تست‌ها از page استفاده می‌کنند نه request
    baseURL: 'http://demo.localhost:3000',
    locale: 'fa-IR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'browser',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) },
    },
  ],
  webServer: [
    {
      // خودش API را بالا می‌آورد تا خروجی (کد OTP) در فایل لاگ بماند؛ پس هرگز reuse نمی‌کنیم
      command: 'node scripts/run-api.mjs',
      url: 'http://localhost:4000/api/health/live',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // صفحه‌ی /dev/fake-gateway فقط در حالت dev وجود دارد
      command: 'npm run dev -w @myapp/storefront',
      cwd: '../..',
      // پاسخ ۲۰۰ از robots.txt یعنی هم Nuxt و هم زنجیره‌ی API→ویترین سالم است (هاست ناشناخته = Disallow: /)
      url: 'http://127.0.0.1:3000/robots.txt',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
