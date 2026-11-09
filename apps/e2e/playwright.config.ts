import { defineConfig, devices } from '@playwright/test';

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
    // *.localhost در Chromium خودکار به 127.0.0.1 می‌رود
    baseURL: 'http://demo.localhost:3000',
    locale: 'fa-IR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
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
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});