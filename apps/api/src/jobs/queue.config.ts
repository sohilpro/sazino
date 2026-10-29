import type { ConnectionOptions, JobsOptions } from 'bullmq';

/** REDIS_URL را به گزینه‌های اتصال BullMQ تبدیل می‌کند */
export function redisConnection(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

const DAY = 24 * 60 * 60;

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  // jobهای کامل‌شده برای جلوگیری از اجرای تکراری (jobId ثابت) چند روز می‌مانند
  removeOnComplete: { age: 3 * DAY, count: 5000 },
  removeOnFail: { age: 14 * DAY },
};