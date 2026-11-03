import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PLANS } from '../../src/plans/plan-defaults';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { cookieHeader, cookieLine, cookieValue } from '../helpers/cookies';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, subdomainHost, type TenantFixture } from '../helpers/fixtures';

const RUN = randomUUID().slice(0, 6);
const PASSWORD = 'AdminPass-12345';

describe('Super admin', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let jwt: JwtService;
  let adminEmail = '';
  let cookie = '';
  const fixtures: TenantFixture[] = [];
  const registeredTenants: string[] = [];

  const http = () => request(app.getHttpServer());
  const admin = {
    get: (p: string) => http().get(`/api/admin${p}`).set('Cookie', cookie),
    post: (p: string, body: object = {}) => http().post(`/api/admin${p}`).set('Cookie', cookie).send(body),
    put: (p: string, body: object = {}) => http().put(`/api/admin${p}`).set('Cookie', cookie).send(body),
  };
  const loginAs = (email: string, password: string) =>
    http().post('/api/admin/auth/login').send({ email, password });
  const clearLoginKeys = async () => {
    const keys = await redis.keys('admin:login:*');
    if (keys.length) await redis.del(...keys);
  };
  const sign = (u: { id: string; tenantId: string; role: string }) =>
    jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });

  async function newAdmin(opts: { isActive?: boolean } = {}) {
    const email = `admin-${randomUUID().slice(0, 8)}-${RUN}@platform.test`;
    await prisma.platformAdmin.create({
      data: { email, name: 'ادمین تست', passwordHash: await bcrypt.hash(PASSWORD, 4), isActive: opts.isActive ?? true },
    });
    return email;
  }

  async function store(tag: string, plan: 'FREE' | 'BASIC' | 'PRO' = 'FREE') {
    const f = await createFixture(prisma, tag, { plan });
    fixtures.push(f);
    return { f, token: await sign(f.owner) };
  }

  /** فروشگاه واقعی با ثبت‌نام (ورود، refresh و رمز واقعی دارد) */
  async function register() {
    const n = `${RUN}${Math.floor(Math.random() * 10_000)}`;
    const res = await http()
      .post('/api/auth/register')
      .send({
        storeName: 'فروشگاه تست',
        subdomain: `adm${n}`,
        name: 'مالک',
        email: `reg${n}@test.dev`,
        password: 'Password123!',
      })
      .expect(201);
    registeredTenants.push(res.body.tenant.id);
    return {
      id: res.body.tenant.id as string,
      email: `reg${n}@test.dev`,
      accessToken: res.body.accessToken as string,
      refresh: cookieHeader({ refresh_token: cookieValue(res, 'refresh_token') }),
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    jwt = app.get(JwtService, { strict: false });
    await clearLoginKeys();

    adminEmail = await newAdmin();
    const res = await loginAs(adminEmail, PASSWORD).expect(200);
    cookie = cookieHeader({ admin_session: cookieValue(res, 'admin_session') });
  });

  afterAll(async () => {
    await clearLoginKeys();
    for (const p of DEFAULT_PLANS) {
      await prisma.plan.upsert({ where: { key: p.key }, update: { ...p }, create: { ...p } });
    }
    await prisma.platformAdmin.deleteMany({ where: { email: { endsWith: `-${RUN}@platform.test` } } });
    await prisma.adminAuditLog.deleteMany({ where: { adminEmail: { endsWith: `-${RUN}@platform.test` } } });
    await prisma.tenant.deleteMany({ where: { id: { in: registeredTenants } } });
    await redis.del(...fixtures.map((f) => CACHE_PREFIX + subdomainHost(f)));
    await cleanupFixtures(prisma, fixtures);
    await app.close();
  });

  // ─────────────────────────── ورود ───────────────────────────
  describe('authentication', () => {
    it('sets a strict, httpOnly cookie scoped to the admin api and returns the admin', async () => {
      const email = await newAdmin();
      const res = await loginAs(email, PASSWORD).expect(200);

      expect(res.body).toMatchObject({ email, name: 'ادمین تست' });
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.headers['cache-control']).toBe('no-store');

      const line = cookieLine(res, 'admin_session')!;
      expect(line).toContain('HttpOnly');
      expect(line).toContain('SameSite=Strict');
      expect(line).toContain('Path=/api/admin');

      const me = await http().get('/api/admin/auth/me').set('Cookie', cookieHeader({ admin_session: cookieValue(res, 'admin_session') })).expect(200);
      expect(me.body.email).toBe(email);
    });

    it('stores only a hash of the session token', async () => {
      const email = await newAdmin();
      const res = await loginAs(email, PASSWORD).expect(200);
      const token = cookieValue(res, 'admin_session')!;

      const rows = await prisma.adminSession.findMany({ where: { admin: { is: { email } } } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.tokenHash).not.toBe(token);
      expect(rows[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      const hours = (rows[0]!.expiresAt.getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(11);
      expect(hours).toBeLessThanOrEqual(12);
    });

    it('gives the same generic error for a wrong password, unknown email and inactive admin', async () => {
      const inactive = await newAdmin({ isActive: false });
      const results = await Promise.all([
        loginAs(adminEmail, 'WrongPassword-123').expect(401),
        loginAs(`nobody-${RUN}@platform.test`, PASSWORD).expect(401),
        loginAs(inactive, PASSWORD).expect(401),
      ]);
      for (const r of results) expect(r.body.message).toBe('ایمیل یا رمز عبور اشتباه است');
      for (const r of results) expect(cookieLine(r, 'admin_session')).toBeUndefined();
    });

    it('locks out after repeated failures, even for the right password', async () => {
      const email = await newAdmin();
      for (let i = 0; i < 5; i++) await loginAs(email, 'WrongPassword-123').expect(401);

      const blocked = await loginAs(email, PASSWORD).expect(429);
      expect(blocked.body.retryAfter).toBeGreaterThan(0);
      await clearLoginKeys();
      await loginAs(email, PASSWORD).expect(200);
    });

    it('validates the payload', async () => {
      await loginAs('not-an-email', PASSWORD).expect(400);
      await http().post('/api/admin/auth/login').send({ email: adminEmail }).expect(400);
      await http().post('/api/admin/auth/login').send({ email: adminEmail, password: PASSWORD, extra: 1 }).expect(400);
    });

    it('logout revokes the session and clears the cookie', async () => {
      const email = await newAdmin();
      const login = await loginAs(email, PASSWORD).expect(200);
      const c = cookieHeader({ admin_session: cookieValue(login, 'admin_session') });

      const res = await http().post('/api/admin/auth/logout').set('Cookie', c).expect(204);
      expect(cookieLine(res, 'admin_session')).toMatch(/Expires=Thu, 01 Jan 1970/);
      await http().get('/api/admin/auth/me').set('Cookie', c).expect(401);
    });

    it('rejects expired sessions and deactivated admins immediately', async () => {
      const email = await newAdmin();
      const login = await loginAs(email, PASSWORD).expect(200);
      const c = cookieHeader({ admin_session: cookieValue(login, 'admin_session') });
      await http().get('/api/admin/auth/me').set('Cookie', c).expect(200);

      await prisma.platformAdmin.update({ where: { email }, data: { isActive: false } });
      await http().get('/api/admin/auth/me').set('Cookie', c).expect(401);

      await prisma.platformAdmin.update({ where: { email }, data: { isActive: true } });
      await prisma.adminSession.updateMany({ where: { admin: { is: { email } } }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await http().get('/api/admin/auth/me').set('Cookie', c).expect(401);
    });

    it('keeps seller and admin credentials completely apart', async () => {
      const { token } = await store('auth');

      // توکن فروشنده برای ادمین بی‌ارزش است
      await http().get('/api/admin/tenants').set('Authorization', `Bearer ${token}`).expect(401);
      await http().get('/api/admin/tenants').expect(401);
      await http().post('/api/admin/tenants/x/suspend').expect(401);

      // و کوکی ادمین برای API فروشنده
      await http().get('/api/orders').set('Cookie', cookie).expect(401);
      await http().get('/api/plan').set('Cookie', cookie).expect(401);
    });
  });

  // ─────────────────────────── فروشگاه‌ها ───────────────────────────
  describe('tenants', () => {
    it('lists, filters, searches and paginates', async () => {
      const a = await store(`l1${RUN}`, 'FREE');
      const b = await store(`l2${RUN}`, 'PRO');
      await prisma.tenant.update({ where: { id: b.f.tenant.id }, data: { status: 'SUSPENDED' } });

      const bySubdomain = await admin.get(`/tenants?q=${a.f.tenant.subdomain}`).expect(200);
      expect(bySubdomain.body.items.map((t: { id: string }) => t.id)).toEqual([a.f.tenant.id]);
      expect(bySubdomain.body.items[0]).toMatchObject({
        name: a.f.tenant.name,
        plan: 'FREE',
        status: 'ACTIVE',
        ownerEmail: a.f.owner.email,
        domainCount: 1, // دامنه‌ی fixture
      });

      const byOwner = await admin.get(`/tenants?q=${encodeURIComponent(b.f.owner.email)}`).expect(200);
      expect(byOwner.body.items.map((t: { id: string }) => t.id)).toEqual([b.f.tenant.id]);

      const suspended = await admin.get(`/tenants?status=SUSPENDED&q=${b.f.tenant.subdomain}`).expect(200);
      expect(suspended.body.items).toHaveLength(1);
      expect((await admin.get(`/tenants?status=ACTIVE&q=${b.f.tenant.subdomain}`).expect(200)).body.items).toEqual([]);
      expect((await admin.get(`/tenants?plan=PRO&q=${b.f.tenant.subdomain}`).expect(200)).body.items).toHaveLength(1);

      const page = await admin.get('/tenants?limit=1&page=2').expect(200);
      expect(page.body.items).toHaveLength(1);
      expect(page.body.meta.page).toBe(2);
    });

    it('rejects bad filters', async () => {
      await admin.get('/tenants?status=NOPE').expect(400);
      await admin.get('/tenants?plan=ULTRA').expect(400);
      await admin.get('/tenants?limit=1000').expect(400);
    });

    it('shows full details: usage, plan, staff, domains and audit entries', async () => {
      const { f } = await store('detail', 'BASIC');
      await prisma.media.create({
        data: { tenantId: f.tenant.id, originalName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 5000, width: 1, height: 1 },
      });

      const res = await admin.get(`/tenants/${f.tenant.id}`).expect(200);
      expect(res.body).toMatchObject({
        id: f.tenant.id,
        plan: 'BASIC',
        suspendedReason: null,
        planInfo: { key: 'BASIC' },
        usage: { products: 0, domains: 1, mediaBytes: 5000 },
      });
      expect(res.body.staff.map((u: { email: string }) => u.email).sort()).toEqual([f.owner.email, f.editor.email].sort());
      expect(res.body.staff[0]).not.toHaveProperty('passwordHash');
      expect(res.body.domains).toHaveLength(1);
      expect(res.body.audit).toEqual([]);
    });

    it('answers 404 and 400 for unknown or malformed ids', async () => {
      await admin.get(`/tenants/${randomUUID()}`).expect(404);
      await admin.get('/tenants/not-a-uuid').expect(400);
      await admin.post(`/tenants/${randomUUID()}/suspend`, { reason: 'تست تست' }).expect(404);
      await admin.post(`/tenants/${randomUUID()}/activate`).expect(404);
      await admin.put(`/tenants/${randomUUID()}/plan`, { plan: 'PRO' }).expect(404);
    });

    it('reports the overall numbers', async () => {
      const res = await admin.get('/stats').expect(200);
      expect(res.body.tenants.ACTIVE).toBeGreaterThanOrEqual(1);
      expect(Object.keys(res.body.byPlan).sort()).toEqual(['BASIC', 'FREE', 'PRO']);
      const total = Object.values(res.body.tenants as Record<string, number>).reduce((a, b) => a + b, 0);
      expect(total).toBe(Object.values(res.body.byPlan as Record<string, number>).reduce((a, b) => a + b, 0));
    });
  });

  // ─────────────────────────── تعلیق ───────────────────────────
  describe('suspension', () => {
    it('cuts access immediately: seller api, storefront, login and refresh', async () => {
      const t = await register();
      const sellerGet = () => http().get('/api/plan').set('Authorization', `Bearer ${t.accessToken}`);

      await sellerGet().expect(200); // کش وضعیت گرم می‌شود

      const res = await admin.post(`/tenants/${t.id}/suspend`, { reason: '  نقض قوانین  ' }).expect(200);
      expect(res.body).toMatchObject({ status: 'SUSPENDED', suspendedReason: 'نقض قوانین' });
      expect(res.body.suspendedAt).not.toBeNull();

      // توکنی که هنوز معتبر است، همان لحظه رد می‌شود
      const denied = await sellerGet().expect(403);
      expect(denied.body).toMatchObject({ code: 'TENANT_SUSPENDED' });

      // ویترین
      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: t.id } });
      await http().get('/api/store').set('Host', subdomainHost({ tenant } as TenantFixture)).expect(403);

      // ورود دوباره و تمدید نشست
      await http().post('/api/auth/login').send({ email: t.email, password: 'Password123!' }).expect(403);
      await http().post('/api/auth/refresh').set('Cookie', t.refresh).expect(401);
    });

    it('restores everything on activation', async () => {
      const t = await register();
      await admin.post(`/tenants/${t.id}/suspend`, { reason: 'بررسی' }).expect(200);
      await http().get('/api/plan').set('Authorization', `Bearer ${t.accessToken}`).expect(403);

      const res = await admin.post(`/tenants/${t.id}/activate`).expect(200);
      expect(res.body).toMatchObject({ status: 'ACTIVE', suspendedReason: null, suspendedAt: null });

      await http().get('/api/plan').set('Authorization', `Bearer ${t.accessToken}`).expect(200);
      await http().post('/api/auth/login').send({ email: t.email, password: 'Password123!' }).expect(200);
    });

    it('requires a reason and refuses repeated or pointless changes', async () => {
      const { f } = await store('susp');
      await admin.post(`/tenants/${f.tenant.id}/suspend`, {}).expect(400);
      await admin.post(`/tenants/${f.tenant.id}/suspend`, { reason: 'ab' }).expect(400);
      await admin.post(`/tenants/${f.tenant.id}/suspend`, { reason: 'x'.repeat(301) }).expect(400);
      await admin.post(`/tenants/${f.tenant.id}/suspend`, { reason: 'دلیل', extra: 1 }).expect(400);

      expect((await admin.post(`/tenants/${f.tenant.id}/activate`).expect(409)).body.code).toBe('NOT_SUSPENDED');

      await admin.post(`/tenants/${f.tenant.id}/suspend`, { reason: 'دلیل معتبر' }).expect(200);
      expect((await admin.post(`/tenants/${f.tenant.id}/suspend`, { reason: 'دوباره' }).expect(409)).body.code).toBe(
        'ALREADY_SUSPENDED',
      );
    });

    it('records who did what, with the reason and ip', async () => {
      const { f } = await store('audit');
      await admin.post(`/tenants/${f.tenant.id}/suspend`, { reason: 'بررسی حسابرسی' }).expect(200);
      await admin.post(`/tenants/${f.tenant.id}/activate`).expect(200);

      const detail = await admin.get(`/tenants/${f.tenant.id}`).expect(200);
      expect(detail.body.audit.map((a: { action: string }) => a.action)).toEqual(['tenant.activate', 'tenant.suspend']);
      expect(detail.body.audit[1]).toMatchObject({ adminEmail, details: { reason: 'بررسی حسابرسی' } });

      const row = await prisma.adminAuditLog.findFirstOrThrow({
        where: { targetTenantId: f.tenant.id, action: 'tenant.suspend' },
      });
      expect(row.ip).toBeTruthy();
    });
  });

  // ─────────────────────────── پلن‌ها ───────────────────────────
  describe('plans', () => {
    it('assigns a plan manually and it applies immediately', async () => {
      const { f, token } = await store('plan', 'FREE');
      const sellerPlan = () => http().get('/api/plan').set('Authorization', `Bearer ${token}`);
      expect((await sellerPlan().expect(200)).body.plan.key).toBe('FREE');

      const res = await admin.put(`/tenants/${f.tenant.id}/plan`, { plan: 'PRO' }).expect(200);
      expect(res.body).toMatchObject({ plan: 'PRO', planInfo: { key: 'PRO' } });
      expect((await sellerPlan().expect(200)).body.plan.key).toBe('PRO');

      const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { targetTenantId: f.tenant.id, action: 'tenant.plan' } });
      expect(audit.details).toEqual({ from: 'FREE', to: 'PRO' });
    });

    it('is a no-op (without a log entry) when the plan does not change', async () => {
      const { f } = await store('same', 'BASIC');
      await admin.put(`/tenants/${f.tenant.id}/plan`, { plan: 'BASIC' }).expect(200);
      expect(await prisma.adminAuditLog.count({ where: { targetTenantId: f.tenant.id } })).toBe(0);
    });

    it('rejects unknown plans', async () => {
      const { f } = await store('badplan');
      for (const plan of ['ULTRA', 'pro', '', 5]) {
        await admin.put(`/tenants/${f.tenant.id}/plan`, { plan }).expect(400);
      }
      await admin.put(`/tenants/${f.tenant.id}/plan`, {}).expect(400);
    });

    it('lists and edits plan limits, with unlimited as null', async () => {
      const list = await admin.get('/plans').expect(200);
      expect(list.body.map((p: { key: string }) => p.key)).toEqual(['FREE', 'BASIC', 'PRO']);

      const res = await admin
        .put('/plans/BASIC', { name: 'پایه‌ی جدید', maxProducts: null, maxDomains: 3, maxMediaMb: 4096, priceMonthly: 350_000 })
        .expect(200);
      expect(res.body).toMatchObject({
        key: 'BASIC',
        name: 'پایه‌ی جدید',
        maxProducts: null,
        maxDomains: 3,
        maxMediaMb: 4096,
        priceMonthly: 350_000,
      });

      // ویرایش جزئی فقط همان فیلد را عوض می‌کند
      await admin.put('/plans/BASIC', { maxDomains: 2 }).expect(200);
      expect((await prisma.plan.findUniqueOrThrow({ where: { key: 'BASIC' } })).maxMediaMb).toBe(4096);

      const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { action: 'plan.update', adminEmail } });
      expect(audit.targetTenantId).toBeNull();
    });

    it('validates plan edits and unknown keys', async () => {
      for (const body of [
        { maxProducts: -1 },
        { maxProducts: 1.5 },
        { maxDomains: 'many' },
        { name: 'ا' },
        { priceMonthly: -5 },
        { priceMonthly: null },
        { key: 'PRO' },
      ]) {
        await admin.put('/plans/FREE', body).expect(400);
      }
      await admin.put('/plans/ULTRA', { maxProducts: 1 }).expect(404);
    });

    it('applies edited limits to sellers at once', async () => {
      const { token } = await store('limitedit', 'FREE');
      await admin.put('/plans/FREE', { maxProducts: 0 }).expect(200);

      const res = await http()
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'نمونه', variants: [{ price: 1000 }] })
        .expect(409);
      expect(res.body.message).toContain('شامل ساخت محصول نیست');
    });
  });

  it('refuses everything for a second admin whose session was never created', async () => {
    const fake = cookieHeader({ admin_session: 'a'.repeat(43) });
    await http().get('/api/admin/stats').set('Cookie', fake).expect(401);
    await http().get('/api/admin/plans').set('Cookie', fake).expect(401);
  });
});