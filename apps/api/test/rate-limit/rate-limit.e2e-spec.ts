import { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RATE_LIMIT_OPTIONS } from '../../src/rate-limit/rate-limit.options';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { createTestApp } from '../helpers/create-app';
import {
  cleanupFixtures,
  createFixture,
  subdomainHost,
  type TenantFixture,
} from '../helpers/fixtures';

/** سقف‌ها پنجره‌ی یک‌دقیقه‌ای دارند؛ نزدیک مرز دقیقه صبر می‌کنیم تا تست نصفه نشود */
async function waitForFreshMinute(): Promise<void> {
  const seconds = new Date().getSeconds();
  if (seconds > 50) await new Promise((r) => setTimeout(r, (61 - seconds) * 1000));
}

/** tag باید بین suiteها یکتا باشد: ساب‌دامین از آن ساخته می‌شود و resolver آن را در Redis کش می‌کند */
function suite(name: string, tag: string, ipPerMin: number, tenantPerMin: number) {
  describe(name, () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let redis: Redis;
    let A: TenantFixture;
    let B: TenantFixture;
    const get = (f: TenantFixture) =>
      request(app.getHttpServer()).get('/api/store').set('Host', subdomainHost(f));

    beforeAll(async () => {
      await waitForFreshMinute();
      app = await createTestApp((b) =>
        b
          .overrideProvider(RATE_LIMIT_OPTIONS)
          .useValue({ enabled: true, ipPerMin, tenantPerMin }),
      );
      prisma = app.get(PrismaService);
      redis = app.get<Redis>(REDIS_CLIENT);
      A = await createFixture(prisma, `${tag}a`);
      B = await createFixture(prisma, `${tag}b`);
    });

    afterAll(async () => {
      await redis.del(CACHE_PREFIX + subdomainHost(A), CACHE_PREFIX + subdomainHost(B));
      await cleanupFixtures(prisma, [A, B]);
      await app.close();
    });

    it('answers 429 with Retry-After after the limit and leaves other stores alone', async () => {
      const limit = Math.min(ipPerMin, tenantPerMin);
      for (let i = 0; i < limit; i++) await get(A).expect(200);

      const blocked = await get(A).expect(429);
      expect(blocked.body).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
      const retry = Number(blocked.headers['retry-after']);
      expect(retry).toBeGreaterThanOrEqual(1);
      expect(retry).toBeLessThanOrEqual(60);

      await get(B).expect(200);
    });

    it('does not limit routes outside the storefront', async () => {
      for (let i = 0; i < 8; i++) {
        const res = await request(app.getHttpServer()).get('/api/store-settings');
        expect(res.status).toBe(401);
      }
    });
  });
}

suite('Rate limiting per store and IP', 'rlip', 3, 1000);
suite('Rate limiting per store (all visitors)', 'rlst', 1000, 5);