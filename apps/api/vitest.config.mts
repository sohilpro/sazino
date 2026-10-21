import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.{spec,e2e-spec}.ts'],
    setupFiles: ['test/setup-env.ts'],
    // تست‌ها دیتابیس مشترک دارند، پس فایل‌ها پشت‌سرهم اجرا می‌شوند
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  // SWC متادیتای دکوراتورها (emitDecoratorMetadata) را برای DI در Nest تولید می‌کند
  plugins: [swc.vite({ module: { type: 'es6' } })],
});