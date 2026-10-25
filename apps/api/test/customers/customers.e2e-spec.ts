import { INestApplication, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OTP } from '../../src/customers/customers.constants';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { ConsoleSmsDriver } from '../../src/sms/drivers/console.driver';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { cookieHeader, cookieLine, cookieValue } from '../helpers/cookies';
import { createTestApp } from '../helpers/create-app';
import {
  cleanupFixtures,
  createFixture,
  subdomainHost,
  type TenantFixture,
} from '../helpers/fixtures';

describe('Customer OTP login', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let sms: ConsoleSmsDriver;
  let A: TenantFixture;
  let B: TenantFixture;
  let phoneSeq = 0;

  const uniquePhone = () =>
    `0912${String(7_000_000 + ++phoneSeq + Math.floor(Math.random() * 1000) * 10).slice(-7)}`;
  const call = (
    f: TenantFixture,
    method: 'get' | 'post' | 'patch',
    path: string,
    cookie?: string,
  ) => {
    const req = request(app.getHttpServer())
      [method](`/api/storefront${path}`)
      .set('Host', subdomainHost(f));
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const clearCooldown = (f: TenantFixture, phone: string) =>
    redis.del(`otp:cd:${f.tenant.id}:${phone}`);

  /** درخواست کد و برگرداندن آن از صندوق پیامک */
  async function requestCode(f: TenantFixture, phone: string): Promise<string> {
    sms.outbox.length = 0;
    await clearCooldown(f, phone);
    await call(f, 'post', '/auth/otp').send({ phone }).expect(200);
    return sms.outbox[0]!.args[0]!;
  }

  async function login(f: TenantFixture, phone: string) {
    const code = await requestCode(f, phone);
    const res = await call(f, 'post', '/auth/verify').send({ phone, code }).expect(200);
    return { res, cookie: cookieHeader({ sf_session: cookieValue(res, 'sf_session') }) };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    sms = app.get(ConsoleSmsDriver);
    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');
  });

  afterAll(async () => {
    const keys = [
      ...(await redis.keys(`otp:*:${A.tenant.id}:*`)),
      ...(await redis.keys(`otp:*:${B.tenant.id}:*`)),
      CACHE_PREFIX + subdomainHost(A),
      CACHE_PREFIX + subdomainHost(B),
    ];
    await redis.del(...keys);
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  describe('requesting a code', () => {
    it('sends a 6-digit code to the normalized number', async () => {
      sms.outbox.length = 0;
      const res = await call(A, 'post', '/auth/otp')
        .send({ phone: '+98 912 700 0001' })
        .expect(200);

      expect(res.body).toEqual({ expiresIn: OTP.TTL, resendIn: OTP.RESEND });
      expect(sms.outbox).toHaveLength(1);
      expect(sms.outbox[0]).toMatchObject({ kind: 'otp', to: '09127000001' });
      expect(sms.outbox[0]!.args[0]).toMatch(/^\d{6}$/);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('rejects invalid phone numbers', async () => {
      for (const phone of ['123', '09123', 'abc', '0812345678', '']) {
        await call(A, 'post', '/auth/otp').send({ phone }).expect(400);
      }
      await call(A, 'post', '/auth/otp').send({}).expect(400);
    });

    it('enforces the resend cooldown', async () => {
      const phone = uniquePhone();
      await call(A, 'post', '/auth/otp').send({ phone }).expect(200);
      const res = await call(A, 'post', '/auth/otp').send({ phone }).expect(429);
      expect(res.body.retryAfter).toBeGreaterThan(0);
      expect(res.body.retryAfter).toBeLessThanOrEqual(OTP.RESEND);
    });

    it('limits requests per phone per hour', async () => {
      const phone = uniquePhone();
      for (let i = 0; i < OTP.PHONE_HOURLY; i++) {
        await clearCooldown(A, phone);
        await call(A, 'post', '/auth/otp').send({ phone }).expect(200);
      }
      await clearCooldown(A, phone);
      await call(A, 'post', '/auth/otp').send({ phone }).expect(429);
    });

    it('limits requests per IP per hour', async () => {
      await call(A, 'post', '/auth/otp').send({ phone: uniquePhone() }).expect(200);

      // شمارنده‌ی IP را به سقف می‌رسانیم (TTL حفظ می‌شود)
      const [key] = await redis.keys(`otp:ip:${A.tenant.id}:*`);
      await redis.set(key!, String(OTP.IP_HOURLY), 'KEEPTTL');

      const res = await call(A, 'post', '/auth/otp').send({ phone: uniquePhone() }).expect(429);
      expect(res.body.retryAfter).toBeGreaterThan(0);

      await redis.del(key!); // به تست‌های بعدی آسیب نزند
    });

    it('releases the cooldown when the SMS provider fails', async () => {
      const phone = uniquePhone();
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const spy = vi.spyOn(sms, 'send').mockRejectedValueOnce(new Error('provider down'));

      await call(A, 'post', '/auth/otp').send({ phone }).expect(502);
      spy.mockRestore();

      // بلافاصله می‌تواند دوباره تلاش کند و کدی هم باقی نمانده است
      await call(A, 'post', '/auth/otp').send({ phone }).expect(200);
    });
  });

  describe('verifying a code', () => {
    it('logs in, sets an httpOnly cookie and returns the customer', async () => {
      const phone = uniquePhone();
      const { res, cookie } = await login(A, phone);

      expect(res.body.customer).toMatchObject({ phone, name: null });
      expect(res.headers['cache-control']).toBe('no-store');

      const line = cookieLine(res, 'sf_session')!;
      expect(line).toContain('HttpOnly');
      expect(line).toContain('SameSite=Lax');
      expect(line).toContain('Path=/');
      expect(line).not.toContain('Domain=');

      const session = await call(A, 'get', '/auth/session', cookie).expect(200);
      expect(session.body.customer.phone).toBe(phone);
    });

    it('stores only a hash of the session token and of the code', async () => {
      const phone = uniquePhone();
      const { cookie } = await login(A, phone);
      const token = cookie.split('=')[1]!;

      const rows = await prisma.customerSession.findMany({ where: { tenantId: A.tenant.id } });
      expect(rows.some((r) => r.tokenHash === token)).toBe(false);
      expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.tokenHash))).toBe(true);

      await clearCooldown(A, phone);
      const code = await requestCode(A, phone);
      const stored = await redis.hget(`otp:code:${A.tenant.id}:${phone}`, 'h');
      expect(stored).toBeTruthy();
      expect(stored).not.toContain(code);
    });

    it('accepts Persian digits and formatted numbers', async () => {
      const phone = '09127100000';
      const code = await requestCode(A, '+989127100000');
      const persian = code.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
      const res = await call(A, 'post', '/auth/verify')
        .send({ phone: '۰۹۱۲۷۱۰۰۰۰۰', code: persian })
        .expect(200);
      expect(res.body.customer.phone).toBe(phone);
    });

    it('makes a code single-use', async () => {
      const phone = uniquePhone();
      const code = await requestCode(A, phone);
      await call(A, 'post', '/auth/verify').send({ phone, code }).expect(200);
      await call(A, 'post', '/auth/verify').send({ phone, code }).expect(401);
    });

    it('rejects a wrong code but still accepts the right one afterwards', async () => {
      const phone = uniquePhone();
      const code = await requestCode(A, phone);
      const wrong = code === '000000' ? '111111' : '000000';

      await call(A, 'post', '/auth/verify').send({ phone, code: wrong }).expect(401);
      await call(A, 'post', '/auth/verify').send({ phone, code }).expect(200);
    });

    it('burns the code after too many wrong attempts', async () => {
      const phone = uniquePhone();
      const code = await requestCode(A, phone);
      const wrong = code === '000000' ? '111111' : '000000';

      for (let i = 0; i < OTP.MAX_ATTEMPTS; i++) {
        await call(A, 'post', '/auth/verify').send({ phone, code: wrong }).expect(401);
      }
      await call(A, 'post', '/auth/verify').send({ phone, code }).expect(401);
    });

    it('rejects an expired code', async () => {
      const phone = uniquePhone();
      const code = await requestCode(A, phone);
      await redis.pexpire(`otp:code:${A.tenant.id}:${phone}`, 50);
      await new Promise((r) => setTimeout(r, 120));
      await call(A, 'post', '/auth/verify').send({ phone, code }).expect(401);
    });

    it('rejects a code that was never requested', async () => {
      await call(A, 'post', '/auth/verify')
        .send({ phone: uniquePhone(), code: '123456' })
        .expect(401);
    });

    it('validates the payload', async () => {
      const phone = uniquePhone();
      await call(A, 'post', '/auth/verify').send({ phone, code: '12345' }).expect(400);
      await call(A, 'post', '/auth/verify').send({ phone, code: 'abcdef' }).expect(400);
      await call(A, 'post', '/auth/verify').send({ phone }).expect(400);
    });
  });

  describe('customers and tenants', () => {
    it('logging in twice with the same phone returns the same customer', async () => {
      const phone = uniquePhone();
      const first = await login(A, phone);
      const second = await login(A, phone);
      expect(second.res.body.customer.id).toBe(first.res.body.customer.id);
      expect(await prisma.customer.count({ where: { tenantId: A.tenant.id, phone } })).toBe(1);
    });

    it('the same phone is a separate customer in another store', async () => {
      const phone = uniquePhone();
      const a = await login(A, phone);
      const b = await login(B, phone);
      expect(b.res.body.customer.id).not.toBe(a.res.body.customer.id);
    });

    it('a code for one store cannot be used on another', async () => {
      const phone = uniquePhone();
      const code = await requestCode(A, phone);
      await call(B, 'post', '/auth/verify').send({ phone, code }).expect(401);
    });

    it('a session cookie from one store means nothing on another', async () => {
      const { cookie } = await login(A, uniquePhone());
      const onB = await call(B, 'get', '/auth/session', cookie).expect(200);
      expect(onB.body.customer).toBeNull();
      await call(B, 'get', '/customer', cookie).expect(401);
    });

    it('returns 404 without a store host', async () => {
      await request(app.getHttpServer())
        .post('/api/storefront/auth/otp')
        .send({ phone: uniquePhone() })
        .expect(404);
    });
  });

  describe('session and profile', () => {
    it('reports no customer without a cookie or with a garbage cookie', async () => {
      expect((await call(A, 'get', '/auth/session').expect(200)).body.customer).toBeNull();
      const garbage = await call(A, 'get', '/auth/session', 'sf_session=not-a-real-token').expect(
        200,
      );
      expect(garbage.body.customer).toBeNull();
    });

    it('logout revokes the session and clears the cookie', async () => {
      const { cookie } = await login(A, uniquePhone());
      const res = await call(A, 'post', '/auth/logout', cookie).expect(204);
      expect(cookieLine(res, 'sf_session')).toMatch(/Expires=Thu, 01 Jan 1970/);

      expect((await call(A, 'get', '/auth/session', cookie).expect(200)).body.customer).toBeNull();
    });

    it('requires a session for the profile', async () => {
      await call(A, 'get', '/customer').expect(401);
      await call(A, 'patch', '/customer').send({ name: 'علی' }).expect(401);
    });

    it('updates the profile name', async () => {
      const { cookie } = await login(A, uniquePhone());

      const ok = await call(A, 'patch', '/customer', cookie)
        .send({ name: '  علی رضایی  ' })
        .expect(200);
      expect(ok.body.name).toBe('علی رضایی');
      expect((await call(A, 'get', '/customer', cookie).expect(200)).body.name).toBe('علی رضایی');

      await call(A, 'patch', '/customer', cookie).send({ name: 'ع' }).expect(400);
      await call(A, 'patch', '/customer', cookie).send({ name: 'x', extra: 1 }).expect(400);
    });
  });
});
