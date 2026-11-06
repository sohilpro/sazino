import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CACHE_OPTIONS } from '../../src/cache/cache.options';
import { StorefrontCacheService } from '../../src/cache/storefront-cache.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { createTestApp } from '../helpers/create-app';
import {
  cleanupFixtures,
  createFixture,
  subdomainHost,
  type TenantFixture,
} from '../helpers/fixtures';
import { createProduct } from '../helpers/shop';

describe('Storefront cache', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let cache: StorefrontCacheService;
  let A: TenantFixture;
  let B: TenantFixture;
  let ownerA = '';
  let slugA = '';

  const get = (f: TenantFixture, path: string) =>
    request(app.getHttpServer()).get(path).set('Host', subdomainHost(f));
  const store = (f: TenantFixture, query = '') => get(f, `/api/store${query}`);

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(CACHE_OPTIONS).useValue({ enabled: true, ttlSeconds: 60 }),
    );
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    cache = app.get(StorefrontCacheService);
    A = await createFixture(prisma, 'ca');
    B = await createFixture(prisma, 'cb');
    slugA = (await createProduct(prisma, A, { title: 'محصول کش' })).product.slug;

    const jwt = app.get(JwtService, { strict: false });
    ownerA = await jwt.signAsync({
      sub: A.owner.id,
      tenantId: A.owner.tenantId,
      role: A.owner.role,
    });
  });

  afterAll(async () => {
    for (const f of [A, B]) {
      const keys = await redis.keys(`sfcache:*${f.tenant.id}*`);
      if (keys.length > 0) await redis.del(...keys);
      await redis.del(CACHE_PREFIX + subdomainHost(f));
    }
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  it('misses first, then hits with an identical body', async () => {
    const first = await store(A).expect(200);
    expect(first.headers['x-cache']).toBe('MISS');
    const second = await store(A).expect(200);
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual(first.body);
  });

  it('keeps stores apart', async () => {
    const a = await store(A).expect(200);
    const b = await store(B).expect(200);
    expect(b.headers['x-cache']).toBe('MISS'); // ورودی A به B نمی‌رسد
    expect(a.body.name).not.toBe(b.body.name);

    const bAgain = await store(B).expect(200);
    expect(bAgain.headers['x-cache']).toBe('HIT');
    expect(bAgain.body.name).toBe(B.tenant.name);
  });

  it('caches product reads but never the personal storefront routes', async () => {
    await get(A, `/api/storefront/products/${slugA}`).expect(200);
    const hit = await get(A, `/api/storefront/products/${slugA}`).expect(200);
    expect(hit.headers['x-cache']).toBe('HIT');

    for (const path of [
      '/api/storefront/cart',
      '/api/storefront/auth/session',
      '/api/storefront/customer',
      '/api/storefront/orders',
    ]) {
      const res = await get(A, path);
      expect(res.headers['x-cache'], path).toBeUndefined();
    }
  });

  it('drops the cache as soon as the seller writes', async () => {
    await store(A).expect(200);
    expect((await store(A).expect(200)).headers['x-cache']).toBe('HIT');

    await request(app.getHttpServer())
      .put('/api/store-settings')
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ name: 'نام تازه‌ی کش' })
      .expect(200);

    const after = await store(A).expect(200);
    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body.name).toBe('نام تازه‌ی کش');
  });

  it('does not invalidate other stores', async () => {
    await store(B).expect(200);
    await cache.invalidate(A.tenant.id);
    expect((await store(B).expect(200)).headers['x-cache']).toBe('HIT');
  });

  it('invalidate() turns the next read into a miss', async () => {
    await store(A).expect(200);
    await cache.invalidate(A.tenant.id);
    expect((await store(A).expect(200)).headers['x-cache']).toBe('MISS');
  });

  it('does not cache unknown or long queries, or authenticated requests', async () => {
    expect((await store(A, '?utm_source=x').expect(200)).headers['x-cache']).toBeUndefined();
    expect((await store(A, `?q=${'x'.repeat(101)}`).expect(200)).headers['x-cache']).toBeUndefined();
    const authed = await store(A).set('Authorization', `Bearer ${ownerA}`).expect(200);
    expect(authed.headers['x-cache']).toBeUndefined();
  });
});