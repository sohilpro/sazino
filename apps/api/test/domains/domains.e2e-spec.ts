import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DNS_LOOKUP } from '../../src/domains/dns-lookup';
import { DomainVerifier, VERIFY_LABEL, VERIFY_PREFIX } from '../../src/domains/domain-verifier';
import { VERIFY_COOLDOWN_MS } from '../../src/domains/domains.constants';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { TenantResolver } from '../../src/tenants/tenant-resolver';
import { createTestApp } from '../helpers/create-app';
import { FakeDns } from '../helpers/fake-dns';
import {
  cleanupFixtures,
  createFixture,
  subdomainHost,
  type TenantFixture,
} from '../helpers/fixtures';

const TOKEN = 'test-internal-token-test-internal-token-0001';
const RUN = randomUUID().slice(0, 6);
let counter = 0;
const uniqueHost = (prefix = 'shop') => `${prefix}${++counter}-${RUN}.example.org`;

describe('Custom domains', () => {
  const dns = new FakeDns();
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let resolver: TenantResolver;
  let verifier: DomainVerifier;
  let A: TenantFixture;
  let B: TenantFixture;
  let owner = '';
  let editor = '';
  let ownerB = '';

  const seller = (token: string) => ({
    get: (path = '') =>
      request(app.getHttpServer())
        .get(`/api/domains${path}`)
        .set('Authorization', `Bearer ${token}`),
    post: (path = '', body: object = {}) =>
      request(app.getHttpServer())
        .post(`/api/domains${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    del: (path: string) =>
      request(app.getHttpServer())
        .delete(`/api/domains${path}`)
        .set('Authorization', `Bearer ${token}`),
  });
  const storeAt = (host: string) =>
    request(app.getHttpServer()).get('/api/store').set('Host', host);
  const ask = (query: Record<string, string | undefined>) =>
    request(app.getHttpServer()).get('/api/internal/domains/check').query(query);

  /** رکوردهای درست DNS برای یک دامنه */
  const setDns = (
    hostname: string,
    token: string,
    opts: { txt?: boolean; routing?: boolean } = {},
  ) => {
    if (opts.txt !== false) dns.setTxt(`${VERIFY_LABEL}.${hostname}`, [`${VERIFY_PREFIX}${token}`]);
    if (opts.routing !== false) dns.setCname(hostname, [verifier.cnameTarget]);
  };
  const resetCooldown = (id: string) =>
    prisma.domain.update({
      where: { id },
      data: { lastCheckedAt: new Date(Date.now() - 2 * VERIFY_COOLDOWN_MS) },
    });

  async function addDomain(token: string, hostname: string) {
    const res = await seller(token).post('', { hostname }).expect(201);
    return res.body as { id: string; hostname: string; dns: { txtName: string; txtValue: string } };
  }
  const tokenOf = (d: { dns: { txtValue: string } }) => d.dns.txtValue.slice(VERIFY_PREFIX.length);

  beforeAll(async () => {
    app = await createTestApp((b) => b.overrideProvider(DNS_LOOKUP).useValue(dns));
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    resolver = app.get(TenantResolver);
    verifier = app.get(DomainVerifier);

    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');

    const jwt = app.get(JwtService, { strict: false });
    const sign = (u: { id: string; tenantId: string; role: string }) =>
      jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });
    owner = await sign(A.owner);
    editor = await sign(A.editor);
    ownerB = await sign(B.owner);
  });

  beforeEach(async () => {
    dns.reset();
    // هر تست با فروشگاهی «تمیز» شروع می‌کند: فقط دامنه‌ی خود fixture می‌ماند
    // (سقف ۵ دامنه‌ی هر فروشگاه بین تست‌ها مشترک نیست)
    await prisma.domain.deleteMany({
      where: {
        tenantId: { in: [A.tenant.id, B.tenant.id] },
        id: { notIn: [A.domain.id, B.domain.id] },
      },
    });
  });

  afterAll(async () => {
    await redis.del(`tenant:host:${subdomainHost(A)}`, `tenant:host:${subdomainHost(B)}`);
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  // ─────────────────────────── افزودن ───────────────────────────
  describe('adding a domain', () => {
    it('normalizes the name and returns the dns instructions', async () => {
      const host = uniqueHost('www');
      const res = await seller(owner)
        .post('', { hostname: `  HTTPS://${host.toUpperCase()}/path  ` })
        .expect(201);

      expect(res.body).toMatchObject({
        hostname: host,
        status: 'PENDING',
        isPrimary: false,
        verifiedAt: null,
        lastCheckedAt: null,
      });
      expect(res.body.dns.txtName).toBe(`${VERIFY_LABEL}.${host}`);
      expect(res.body.dns.txtValue).toMatch(/^myapp-verify=[0-9a-f]{48}$/);
      expect(res.body.dns.cnameTarget).toBe(verifier.cnameTarget);
    });

    it('rejects invalid, reserved and platform names', async () => {
      for (const hostname of [
        'localhost',
        '127.0.0.1',
        'singlelabel',
        'a_b.example.org',
        'shop.test',
        'x.local',
        'a..b.com',
      ]) {
        await seller(owner).post('', { hostname }).expect(400);
      }
      // دامنه‌ی خود پلتفرم و زیردامنه‌هایش (در تست PLATFORM_DOMAIN = localhost است)
      await seller(owner)
        .post('', { hostname: subdomainHost(A) })
        .expect(400);
      await seller(owner).post('', { hostname: '' }).expect(400);
      await seller(owner).post('', { hostname: 'x.example.org', plan: 'PRO' }).expect(400);
    });

    it('rejects a duplicate in the same store', async () => {
      const host = uniqueHost();
      await addDomain(owner, host);
      const res = await seller(owner).post('', { hostname: host }).expect(409);
      expect(res.body.code).toBe('DOMAIN_EXISTS');
    });

    it('limits the number of domains by plan', async () => {
      const C = await createFixture(prisma, 'c');
      try {
        // دامنه‌ی fixture هم یکی از دامنه‌ها حساب می‌شود؛ برای شمارش دقیق حذفش می‌کنیم
        await prisma.domain.deleteMany({ where: { tenantId: C.tenant.id } });
        const token = await app
          .get(JwtService, { strict: false })
          .signAsync({ sub: C.owner.id, tenantId: C.tenant.id, role: 'OWNER' });

        for (let i = 0; i < 5; i++) await addDomain(token, uniqueHost('lim'));

        const res = await seller(token)
          .post('', { hostname: uniqueHost('over') })
          .expect(409);
        expect(res.body).toMatchObject({
          code: 'PLAN_LIMIT',
          resource: 'domains',
          limit: 5,
          used: 5,
        });

        // با حذف یکی، دوباره جا باز می‌شود
        const list = (await seller(token).get().expect(200)).body.items as Array<{ id: string }>;
        await seller(token).del(`/${list[0]!.id}`).expect(204);
        await seller(token)
          .post('', { hostname: uniqueHost('again') })
          .expect(201);
      } finally {
        await cleanupFixtures(prisma, [C]);
      }
    });

    it('lets only owners and admins add, but everyone list', async () => {
      await seller(editor).post('', { hostname: uniqueHost() }).expect(403);
      await seller(editor).get().expect(200);
      await request(app.getHttpServer()).get('/api/domains').expect(401);
    });

    it('lists only the own domains', async () => {
      const host = uniqueHost('mine');
      await addDomain(owner, host);

      const a = (await seller(owner).get().expect(200)).body;
      expect(a.limit).toBe(5);
      expect(a.items.map((d: { hostname: string }) => d.hostname)).toContain(host);

      const b = (await seller(ownerB).get().expect(200)).body;
      expect(b.items.map((d: { hostname: string }) => d.hostname)).not.toContain(host);
    });
  });

  // ─────────────────────────── تأیید ───────────────────────────
  describe('verification', () => {
    it('stays pending while the dns records are missing and reports what is wrong', async () => {
      const host = uniqueHost();
      const d = await addDomain(owner, host);

      const res = await seller(owner).post(`/${d.id}/verify`).expect(200);
      expect(res.body).toMatchObject({ verified: false, unavailable: false });
      expect(res.body.domain).toMatchObject({ status: 'PENDING', isPrimary: false });
      expect(res.body.domain.lastCheckedAt).not.toBeNull();
      expect(res.body.checks).toMatchObject({ txt: { ok: false }, routing: { ok: false } });
    });

    it('needs both ownership and routing', async () => {
      const host = uniqueHost();
      const d = await addDomain(owner, host);

      setDns(host, tokenOf(d), { routing: false });
      let res = await seller(owner).post(`/${d.id}/verify`).expect(200);
      expect(res.body.verified).toBe(false);
      expect(res.body.checks).toMatchObject({ txt: { ok: true }, routing: { ok: false } });

      await resetCooldown(d.id);
      dns.reset();
      setDns(host, tokenOf(d), { txt: false });
      res = await seller(owner).post(`/${d.id}/verify`).expect(200);
      expect(res.body.checks).toMatchObject({
        txt: { ok: false },
        routing: { ok: true, via: 'cname' },
      });
      expect(res.body.verified).toBe(false);
    });

    it('enforces a cooldown between checks', async () => {
      const d = await addDomain(owner, uniqueHost());
      await seller(owner).post(`/${d.id}/verify`).expect(200);

      const res = await seller(owner).post(`/${d.id}/verify`).expect(429);
      expect(res.body.retryAfter).toBeGreaterThan(0);
      expect(res.body.retryAfter).toBeLessThanOrEqual(VERIFY_COOLDOWN_MS / 1000);
    });

    it('activates the domain, makes it primary and serves the store immediately', async () => {
      const host = uniqueHost('live');
      const d = await addDomain(owner, host);

      // قبل از تأیید: فروشگاهی روی این Host نیست (و این «نبودن» در کش ثبت می‌شود)
      await storeAt(host).expect(404);

      setDns(host, tokenOf(d));
      const res = await seller(owner).post(`/${d.id}/verify`).expect(200);
      expect(res.body.verified).toBe(true);
      expect(res.body.domain).toMatchObject({ status: 'VERIFIED' });
      expect(res.body.domain.verifiedAt).not.toBeNull();

      const row = await prisma.domain.findUniqueOrThrow({ where: { id: d.id } });
      expect(row).toMatchObject({ verifiedHostname: host, checkFailures: 0 });

      // کش پاک شده و دامنه فوراً کار می‌کند
      const store = await storeAt(host).expect(200);
      expect(store.body.id).toBe(A.tenant.id);
    });

    it('makes only the first verified domain primary', async () => {
      const C = await createFixture(prisma, 'c');
      try {
        const token = await app
          .get(JwtService, { strict: false })
          .signAsync({ sub: C.owner.id, tenantId: C.tenant.id, role: 'OWNER' });
        // دامنه‌ی fixture در این فروشگاه primary نیست؛ پس اولین دامنه‌ی تأییدشده‌ی واقعی primary می‌شود
        const first = await addDomain(token, uniqueHost('one'));
        const second = await addDomain(token, uniqueHost('two'));
        setDns(first.hostname, tokenOf(first));
        setDns(second.hostname, tokenOf(second));

        expect(
          (await seller(token).post(`/${first.id}/verify`).expect(200)).body.domain.isPrimary,
        ).toBe(true);
        expect(
          (await seller(token).post(`/${second.id}/verify`).expect(200)).body.domain.isPrimary,
        ).toBe(false);
      } finally {
        await cleanupFixtures(prisma, [C]);
      }
    });

    it('is idempotent for an already verified domain', async () => {
      const host = uniqueHost();
      const d = await addDomain(owner, host);
      setDns(host, tokenOf(d));
      await seller(owner).post(`/${d.id}/verify`).expect(200);

      dns.reset(); // حتی اگر DNS الان خالی باشد
      const res = await seller(owner).post(`/${d.id}/verify`).expect(200);
      expect(res.body).toMatchObject({ verified: true, checks: null });
    });

    it('reports "undetermined" (not failed) when dns does not answer', async () => {
      const host = uniqueHost();
      const d = await addDomain(owner, host);
      dns.fail(`${VERIFY_LABEL}.${host}`);

      const res = await seller(owner).post(`/${d.id}/verify`).expect(200);
      expect(res.body).toMatchObject({ verified: false, unavailable: true, checks: null });
      expect(res.body.domain.status).toBe('PENDING');
    });

    it('lets only the first store that proves ownership win the domain', async () => {
      const host = uniqueHost('contested');
      const forA = await addDomain(owner, host);
      const forB = await addDomain(ownerB, host); // «در انتظار» بودن دامنه‌ی فروشگاه دیگر مانع نیست

      // هر دو توکن در DNS هست؛ اولی که بررسی کند برنده است
      dns.setTxt(`${VERIFY_LABEL}.${host}`, [
        `${VERIFY_PREFIX}${tokenOf(forA)}`,
        `${VERIFY_PREFIX}${tokenOf(forB)}`,
      ]);
      dns.setCname(host, [verifier.cnameTarget]);

      await seller(owner).post(`/${forA.id}/verify`).expect(200);
      const lost = await seller(ownerB).post(`/${forB.id}/verify`).expect(409);
      expect(lost.body.code).toBe('DOMAIN_TAKEN');

      expect((await storeAt(host).expect(200)).body.id).toBe(A.tenant.id);

      // ثبت دوباره‌ی دامنه‌ی تأییدشده‌ی فروشگاه دیگر هم رد می‌شود
      await seller(ownerB).del(`/${forB.id}`).expect(204);
      expect((await seller(ownerB).post('', { hostname: host }).expect(409)).body.code).toBe(
        'DOMAIN_TAKEN',
      );
    });

    it('cannot verify a domain of another store', async () => {
      const d = await addDomain(owner, uniqueHost());
      await seller(ownerB).post(`/${d.id}/verify`).expect(404);
      await seller(ownerB).post(`/${d.id}/primary`).expect(404);
      await seller(ownerB).del(`/${d.id}`).expect(404);
    });

    it('restricts verification to owners and admins', async () => {
      const d = await addDomain(owner, uniqueHost());
      await seller(editor).post(`/${d.id}/verify`).expect(403);
    });
  });

  // ─────────────────────────── دامنه‌ی اصلی و حذف ───────────────────────────
  describe('primary domain and removal', () => {
    async function verified(token: string, tenant: TenantFixture, prefix: string) {
      const d = await addDomain(token, uniqueHost(prefix));
      setDns(d.hostname, tokenOf(d));
      await seller(token).post(`/${d.id}/verify`).expect(200);
      void tenant;
      return d;
    }

    it('switches the primary domain and only verified ones can be primary', async () => {
      const first = await verified(owner, A, 'p1');
      const second = await verified(owner, A, 'p2');
      const pending = await addDomain(owner, uniqueHost('pend'));

      await seller(owner).post(`/${pending.id}/primary`).expect(409);

      const res = await seller(owner).post(`/${second.id}/primary`).expect(200);
      expect(res.body.isPrimary).toBe(true);

      const list = (await seller(owner).get().expect(200)).body.items as Array<{
        id: string;
        isPrimary: boolean;
      }>;
      expect(list.filter((d) => d.isPrimary).map((d) => d.id)).toEqual([second.id]);
      void first;
    });

    it('promotes another verified domain when the primary is removed, and stops serving the removed one', async () => {
      const C = await createFixture(prisma, 'c');
      try {
        const token = await app
          .get(JwtService, { strict: false })
          .signAsync({ sub: C.owner.id, tenantId: C.tenant.id, role: 'OWNER' });

        const one = await addDomain(token, uniqueHost('x1'));
        const two = await addDomain(token, uniqueHost('x2'));
        for (const d of [one, two]) {
          setDns(d.hostname, tokenOf(d));
          await seller(token).post(`/${d.id}/verify`).expect(200);
        }
        await storeAt(one.hostname).expect(200);

        await seller(token).del(`/${one.id}`).expect(204);
        await storeAt(one.hostname).expect(404); // کش پاک شده

        const list = (await seller(token).get().expect(200)).body.items as Array<{
          id: string;
          isPrimary: boolean;
        }>;
        expect(list.find((d) => d.id === two.id)?.isPrimary).toBe(true);
      } finally {
        await cleanupFixtures(prisma, [C]);
      }
    });

    it('uses the primary domain in the store address, and falls back to the platform subdomain', async () => {
      const C = await createFixture(prisma, 'c');
      await prisma.domain.deleteMany({ where: { tenantId: C.tenant.id } }); // دامنه‌ی fixture جانشین اصلی می‌شد
      try {
        const token = await app
          .get(JwtService, { strict: false })
          .signAsync({ sub: C.owner.id, tenantId: C.tenant.id, role: 'OWNER' });
        const settings = () =>
          request(app.getHttpServer())
            .get('/api/store-settings')
            .set('Authorization', `Bearer ${token}`);

        expect((await settings().expect(200)).body.storeUrl).toContain(C.tenant.subdomain);

        const d = await addDomain(token, uniqueHost('brand'));
        setDns(d.hostname, tokenOf(d));
        await seller(token).post(`/${d.id}/verify`).expect(200);
        expect((await settings().expect(200)).body.storeUrl).toBe(`http://${d.hostname}`);

        await seller(token).del(`/${d.id}`).expect(204);
        expect((await settings().expect(200)).body.storeUrl).toContain(C.tenant.subdomain);
      } finally {
        await cleanupFixtures(prisma, [C]);
      }
    });
  });

  // ─────────────────────────── endpoint داخلی Caddy ───────────────────────────
  describe('on-demand tls approval', () => {
    it('approves the subdomain of an active store', async () => {
      await ask({ token: TOKEN, domain: subdomainHost(A) }).expect(200);
    });

    it('approves a verified custom domain only', async () => {
      const host = uniqueHost('tls');
      const d = await addDomain(owner, host);

      await ask({ token: TOKEN, domain: host }).expect(404); // هنوز در انتظار

      setDns(host, tokenOf(d));
      await seller(owner).post(`/${d.id}/verify`).expect(200);
      const res = await ask({ token: TOKEN, domain: host }).expect(200);
      expect(res.body).toEqual({ ok: true });
      expect(res.headers['cache-control']).toBe('no-store');

      await seller(owner).del(`/${d.id}`).expect(204);
      await ask({ token: TOKEN, domain: host }).expect(404);
    });

    it('refuses everything else', async () => {
      for (const domain of [
        'unknown.example.org',
        `nope-${RUN}.localhost`,
        'localhost',
        'www.localhost',
        '127.0.0.1',
        '',
        'a'.repeat(300),
      ]) {
        const res = await ask({ token: TOKEN, domain });
        expect([400, 404], domain).toContain(res.status);
        expect(res.status === 200).toBe(false);
      }
      await ask({ token: TOKEN }).expect(404);
    });

    it('needs the shared token', async () => {
      await ask({ domain: subdomainHost(A) }).expect(404);
      await ask({ token: 'wrong', domain: subdomainHost(A) }).expect(404);
      await ask({ token: `${TOKEN}x`, domain: subdomainHost(A) }).expect(404);
    });

    it('refuses suspended stores', async () => {
      await prisma.tenant.update({ where: { id: B.tenant.id }, data: { status: 'SUSPENDED' } });
      await resolver.invalidateTenant(B.tenant.id);
      await ask({ token: TOKEN, domain: subdomainHost(B) }).expect(404);

      await prisma.tenant.update({ where: { id: B.tenant.id }, data: { status: 'ACTIVE' } });
      await resolver.invalidateTenant(B.tenant.id);
      await ask({ token: TOKEN, domain: subdomainHost(B) }).expect(200);
    });

    it('rejects unknown query parameters', async () => {
      await ask({ token: TOKEN, domain: subdomainHost(A), extra: '1' }).expect(400);
    });
  });
});
