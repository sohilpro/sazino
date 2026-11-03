import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PLANS } from '../../src/plans/plan-defaults';
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
import { PlansService } from '../../src/plans/plans.service';

const RUN = randomUUID().slice(0, 6);
let seq = 0;

describe('Plan limits', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let jwt: JwtService;
  const fixtures: TenantFixture[] = [];

  const resetPlans = async () => {
    for (const p of DEFAULT_PLANS) {
      await prisma.plan.upsert({ where: { key: p.key }, update: { ...p }, create: { ...p } });
    }
  };
  const setPlan = (key: string, data: Record<string, unknown>) =>
    prisma.plan.update({ where: { key }, data });

  async function store(tag: string, plan: 'FREE' | 'BASIC' | 'PRO') {
    const f = await createFixture(prisma, tag, { plan });
    fixtures.push(f);
    const sign = (u: { id: string; tenantId: string; role: string }) =>
      jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });
    return { f, owner: await sign(f.owner), editor: await sign(f.editor) };
  }

  const as = (token: string) => ({
    get: (p: string) =>
      request(app.getHttpServer()).get(`/api${p}`).set('Authorization', `Bearer ${token}`),
    post: (p: string, body: object = {}) =>
      request(app.getHttpServer())
        .post(`/api${p}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    patch: (p: string, body: object = {}) =>
      request(app.getHttpServer())
        .patch(`/api${p}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    del: (p: string) =>
      request(app.getHttpServer()).delete(`/api${p}`).set('Authorization', `Bearer ${token}`),
  });
  const product = (n = ++seq) => ({ title: `محصول ${n} ${RUN}`, variants: [{ price: 1000 }] });
  const jpeg = () =>
    sharp({ create: { width: 200, height: 200, channels: 3, background: '#4f46e5' } })
      .jpeg()
      .toBuffer();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    jwt = app.get(JwtService, { strict: false });
    await resetPlans();
  });

  afterAll(async () => {
    await resetPlans(); // سقف‌هایی که تست عوض کرده به حالت پیش‌فرض برمی‌گردد
    await redis.del(...fixtures.map((f) => CACHE_PREFIX + subdomainHost(f)));
    await cleanupFixtures(prisma, fixtures);
    await app.close();
  });

  // ─────────────────────────── محصول ───────────────────────────
  describe('products', () => {
    it('allows products up to the limit, then answers 409 with details', async () => {
      await setPlan('FREE', { maxProducts: 2 });
      const { owner } = await store('p1', 'FREE');

      await as(owner).post('/products', product()).expect(201);
      await as(owner).post('/products', product()).expect(201);

      const res = await as(owner).post('/products', product()).expect(409);
      expect(res.body).toMatchObject({
        code: 'PLAN_LIMIT',
        resource: 'products',
        limit: 2,
        used: 2,
      });
      expect(res.body.message).toContain('رایگان');
    });

    it('frees a slot when a product is deleted', async () => {
      await setPlan('FREE', { maxProducts: 1 });
      const { owner } = await store('p2', 'FREE');

      const created = (await as(owner).post('/products', product()).expect(201)).body;
      await as(owner).post('/products', product()).expect(409);

      await as(owner).del(`/products/${created.id}`).expect(204);
      await as(owner).post('/products', product()).expect(201);
    });

    it('never touches existing data when the limit drops below the usage', async () => {
      await setPlan('FREE', { maxProducts: 5 });
      const { owner } = await store('p3', 'FREE');
      const first = (await as(owner).post('/products', product()).expect(201)).body;
      await as(owner).post('/products', product()).expect(201);
      await as(owner).post('/products', product()).expect(201);

      await setPlan('FREE', { maxProducts: 1 }); // کاهش سقف

      expect((await as(owner).get('/products').expect(200)).body.meta.total).toBe(3);
      await as(owner).patch(`/products/${first.id}`, { title: 'ویرایش‌شده' }).expect(200); // ویرایش آزاد است
      await as(owner).post('/products', product()).expect(409); // فقط ساخت جدید بسته است
    });

    it('applies to every role that can create products', async () => {
      await setPlan('FREE', { maxProducts: 1 });
      const { owner, editor } = await store('p4', 'FREE');
      await as(editor).post('/products', product()).expect(201);
      await as(owner).post('/products', product()).expect(409);
    });

    it('has no cap when the limit is null (unlimited)', async () => {
      await setPlan('FREE', { maxProducts: null });
      const { owner } = await store('p5', 'FREE');
      for (let i = 0; i < 4; i++) await as(owner).post('/products', product()).expect(201);
    });

    it('takes effect immediately when the plan changes', async () => {
      await setPlan('FREE', { maxProducts: 1 });
      await setPlan('PRO', { maxProducts: null });
      const { f, owner } = await store('p6', 'FREE');

      await as(owner).post('/products', product()).expect(201);
      await as(owner).post('/products', product()).expect(409);

      await prisma.tenant.update({ where: { id: f.tenant.id }, data: { plan: 'PRO' } });
      await as(owner).post('/products', product()).expect(201);
    });

    it('does not count products of other stores', async () => {
      await setPlan('FREE', { maxProducts: 1 });
      const a = await store('p7a', 'FREE');
      const b = await store('p7b', 'FREE');
      await as(a.owner).post('/products', product()).expect(201);
      await as(b.owner).post('/products', product()).expect(201);
    });
  });

  // ─────────────────────────── دامنه ───────────────────────────
  describe('custom domains', () => {
    const host = () => `d${++seq}-${RUN}.example.org`;

    it('is unavailable on the free plan (limit 0)', async () => {
      const { f, owner } = await store('d1', 'FREE');
      await prisma.domain.deleteMany({ where: { tenantId: f.tenant.id } });

      const list = await as(owner).get('/domains').expect(200);
      expect(list.body.limit).toBe(0);

      const res = await as(owner).post('/domains', { hostname: host() }).expect(409);
      expect(res.body).toMatchObject({ code: 'PLAN_LIMIT', resource: 'domains', limit: 0 });
      expect(res.body.message).toContain('شامل دامنه‌ی اختصاصی نیست');
    });

    it('allows exactly the plan limit', async () => {
      const { f, owner } = await store('d2', 'BASIC');
      await prisma.domain.deleteMany({ where: { tenantId: f.tenant.id } });

      await as(owner).post('/domains', { hostname: host() }).expect(201);
      const res = await as(owner).post('/domains', { hostname: host() }).expect(409);
      expect(res.body).toMatchObject({ code: 'PLAN_LIMIT', limit: 1, used: 1 });
    });

    it('reports the plan limit in the domain list', async () => {
      const { owner } = await store('d3', 'PRO');
      expect((await as(owner).get('/domains').expect(200)).body.limit).toBe(5);

      await setPlan('PRO', { maxDomains: null });
      expect((await as(owner).get('/domains').expect(200)).body.limit).toBeNull();
      await setPlan('PRO', { maxDomains: 5 });
    });

    it('still checks roles before limits', async () => {
      const { editor } = await store('d4', 'FREE');
      await as(editor).post('/domains', { hostname: host() }).expect(403);
    });
  });

  // ─────────────────────────── فضای تصاویر ───────────────────────────
  describe('media quota', () => {
    const upload = (token: string, buffer: Buffer) =>
      request(app.getHttpServer())
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', buffer, { filename: 'a.jpg', contentType: 'image/jpeg' });

    it('rejects an upload that does not fit and stores nothing', async () => {
      await setPlan('FREE', { maxMediaMb: 1 });
      const { f, owner } = await store('m1', 'FREE');
      await prisma.media.create({
        data: {
          tenantId: f.tenant.id,
          originalName: 'big.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1024 * 1024 - 10,
          width: 10,
          height: 10,
        },
      });

      const res = await upload(owner, await jpeg()).expect(409);
      expect(res.body).toMatchObject({ code: 'PLAN_LIMIT', resource: 'media', limit: 1 });
      expect(await prisma.media.count({ where: { tenantId: f.tenant.id } })).toBe(1);
    });

    it('accepts uploads again after space is freed', async () => {
      await setPlan('FREE', { maxMediaMb: 1 });
      const { f, owner } = await store('m2', 'FREE');
      const big = await prisma.media.create({
        data: {
          tenantId: f.tenant.id,
          originalName: 'big.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1024 * 1024,
          width: 10,
          height: 10,
        },
      });
      await upload(owner, await jpeg()).expect(409);

      await as(owner).del(`/media/${big.id}`).expect(204);
      await upload(owner, await jpeg()).expect(201);
    });

    it('counts only the own store', async () => {
      await setPlan('FREE', { maxMediaMb: 1 });
      const a = await store('m3a', 'FREE');
      const b = await store('m3b', 'FREE');
      await prisma.media.create({
        data: {
          tenantId: a.f.tenant.id,
          originalName: 'big.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 5 * 1024 * 1024,
          width: 10,
          height: 10,
        },
      });
      await upload(b.owner, await jpeg()).expect(201);
    });

    it('is unlimited when the limit is null', async () => {
      await setPlan('FREE', { maxMediaMb: null });
      const { f, owner } = await store('m4', 'FREE');
      await prisma.media.create({
        data: {
          tenantId: f.tenant.id,
          originalName: 'huge.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 2_000_000_000,
          width: 10,
          height: 10,
        },
      });
      await upload(owner, await jpeg()).expect(201);
    });
  });

  // ─────────────────────────── GET /plan ───────────────────────────
  describe('GET /plan', () => {
    it('shows the plan, its limits and the current usage', async () => {
      await setPlan('BASIC', { maxProducts: 10 });
      const { f, owner, editor } = await store('u1', 'BASIC');
      await as(owner).post('/products', product()).expect(201);
      await prisma.media.create({
        data: {
          tenantId: f.tenant.id,
          originalName: 'a.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 4096,
          width: 1,
          height: 1,
        },
      });

      const res = await as(editor).get('/plan').expect(200); // همه‌ی نقش‌ها
      expect(res.body.plan).toMatchObject({ key: 'BASIC', name: 'پایه', maxProducts: 10 });
      expect(res.body.usage).toMatchObject({ products: 1, mediaBytes: 4096 });
      expect(typeof res.body.usage.domains).toBe('number');
    });

    it('requires a seller token and stays inside the own store', async () => {
      await request(app.getHttpServer()).get('/api/plan').expect(401);

      const a = await store('u2a', 'FREE');
      const b = await store('u2b', 'PRO');
      expect((await as(a.owner).get('/plan').expect(200)).body.plan.key).toBe('FREE');
      expect((await as(b.owner).get('/plan').expect(200)).body.plan.key).toBe('PRO');
    });
  });

  it('seeds the three default plans at startup without overwriting edits', async () => {
    await setPlan('BASIC', { name: 'پایه‌ی ویژه' });

    await app.get(PlansService).ensureDefaults();

    expect(
      (
        await prisma.plan.findUniqueOrThrow({
          where: { key: 'BASIC' },
        })
      ).name,
    ).toBe('پایه‌ی ویژه');

    expect(
      await prisma.plan.count({
        where: { key: { in: ['FREE', 'BASIC', 'PRO'] } },
      }),
    ).toBe(3);
  });
});
