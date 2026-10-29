import { config } from 'dotenv';
import { Redis } from 'ioredis';

export async function setup() {
  config({ path: ['.env', '../../.env'], quiet: true });
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  try {
    const keys = await redis.keys('myapp-test:*');
    if (keys.length) await redis.del(...keys);
  } finally {
    await redis.quit();
  }
}