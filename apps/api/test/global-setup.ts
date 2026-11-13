import { config } from 'dotenv';
import { Redis } from 'ioredis';
import { ensureTenantRole } from '../scripts/tenant-role';
import { deriveTenantUrl } from './helpers/tenant-url';

export async function setup() {
  config({ path: ['.env', '../../.env'], quiet: true });
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  try {
    const keys = await redis.keys('myapp-test:*');
    if (keys.length) await redis.del(...keys);
  } finally {
    await redis.quit();
  }
  // نقش بدون BYPASSRLS برای تست‌ها (idempotent)
  if (process.env.RLS_TESTS !== 'off' && process.env.DATABASE_URL) {
    const tenantUrl = process.env.TENANT_DATABASE_URL ?? deriveTenantUrl(process.env.DATABASE_URL);
    await ensureTenantRole(process.env.DATABASE_URL, tenantUrl);
  }
}
