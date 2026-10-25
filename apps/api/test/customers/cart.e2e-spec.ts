import { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { ConsoleSmsDriver } from '../../src/sms/drivers/console.driver';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { cookieHeader, cookieLine, cookieValue } from '../helpers/cookies';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, subdomainHost, type TenantFixture } from '../helpers/fixtures';

interface ProductOpts {
  title?: string;
  status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  price?: number;
  quantity?: number;
  allowBackorder?: boolean;
}

describe('Cart', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let sms: ConsoleSmsDriver;
  let A: TenantFixture;
  let B: TenantFixture;
  let phoneSeq = 0;

  const uniquePhone = () => `0913${String(8_000_000 + ++phoneSeq + Math.floor(Math.random() * 1000) * 10).slice(-7)}`;

  async function createProduct(f: TenantFixture, opts: ProductOpts = {}) {
    const price = opts.price ?? 100_000;
    const product = await prisma.product.create({
      data: {
        tenantId: f.tenant.id,
        title: opts.title ?? 'محصول تست',
        slug: `p-${randomUUID().slice(0, 8)}`,
        status: opts.status ?? 'ACTIVE',
        minPrice: price,
        maxPrice: price,
      },
    });
    const variant = await prisma.variant.create({
      data: { tenantId: f.tenant.id, productId: product.id, title: 'پیش‌فرض', price },
    });
    await prisma.inventory.create({
      data: {
        tenantId: f.tenant.id,
        variantId: variant.id,
        quantity: opts.quantity ?? 10,
        allowBackorder: opts.allowBackorder ?? false,
      },
    });
    return { product, variant };
  }

  const call = (
    f: TenantFixture,
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    cookie?: string,
  ) => {
    const req = request(app.getHttpServer())[method](`/api/storefront${path}`).set('Host', subdomainHost(f));
    return cookie ? req.set('Cookie', cookie) : req;
  };

  async function login(f: TenantFixture, phone: string, guestCookie?: string) {
    const key = `otp:cd:${f.tenant.id}:${phone}`;
    await redis.del(key);
    sms.outbox.length = 0;
    await call(f, 'post', '/auth/otp').send({ phone }).expect(200);
    const code = sms.outbox[0]!.args[0]!;
    const res = await call(f, 'post', '/auth/verify', guestCookie).send({ phone, code }).expect(200);
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

  describe('as a guest', () => {
    it('is empty by default and sets no cookie', async () => {
      const res = await call(A, 'get', '/cart').expect(200);
      expect(res.body).toEqual({ items: [], itemCount: 0, subtotal: 0, hasIssues: false });
      expect(cookieLine(res, 'sf_cart')).toBeUndefined();
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('creates a cart cookie on the first add and returns live prices', async () => {
      const { variant, product } = await createProduct(A, { title: 'تیشرت', price: 450_000 });
      const res = await call(A, 'post', '/cart/items').send({ variantId: variant.id, quantity: 2 }).expect(200);

      const line = cookieLine(res, 'sf_cart')!;
      expect(line).toContain('HttpOnly');
      expect(line).toContain('SameSite=Lax');

      expect(res.body).toMatchObject({ itemCount: 2, subtotal: 900_000, hasIssues: false });
      expect(res.body.items[0]).toMatchObject({
        variantId: variant.id,
        productSlug: product.slug,
        productTitle: 'تیشرت',
        unitPrice: 450_000,
        quantity: 2,
        lineTotal: 900_000,
        issue: null,
        imageUrl: null,
      });

      const cookie = cookieHeader({ sf_cart: cookieValue(res, 'sf_cart') });
      const again = await call(A, 'get', '/cart', cookie).expect(200);
      expect(again.body.items).toHaveLength(1);
    });

    it('stores only a hash of the cart token', async () => {
      const { variant } = await createProduct(A);
      const res = await call(A, 'post', '/cart/items').send({ variantId: variant.id, quantity: 1 }).expect(200);
      const token = cookieValue(res, 'sf_cart')!;

      const carts = await prisma.cart.findMany({ where: { tenantId: A.tenant.id, customerId: null } });
      expect(carts.some((c) => c.tokenHash === token)).toBe(false);
      expect(carts.every((c) => /^[0-9a-f]{64}$/.test(c.tokenHash ?? ''))).toBe(true);
    });

    it('adds up quantities for the same variant and keeps one cookie', async () => {
      const { variant } = await createProduct(A);
      const first = await call(A, 'post', '/cart/items').send({ variantId: variant.id, quantity: 2 }).expect(200);
      const cookie = cookieHeader({ sf_cart: cookieValue(first, 'sf_cart') });

      const second = await call(A, 'post', '/cart/items', cookie).send({ variantId: variant.id, quantity: 3 }).expect(200);
      expect(second.body.items).toHaveLength(1);
      expect(second.body.items[0].quantity).toBe(5);
      expect(cookieLine(second, 'sf_cart')).toBeUndefined();
    });

    it('never lets the cart exceed the stock', async () => {
      const { variant } = await createProduct(A, { quantity: 3 });
      const first = await call(A, 'post', '/cart/items').send({ variantId: variant.id, quantity: 3 }).expect(200);
      const cookie = cookieHeader({ sf_cart: cookieValue(first, 'sf_cart') });

      await call(A, 'post', '/cart/items', cookie).send({ variantId: variant.id, quantity: 1 }).expect(409);
      expect((await call(A, 'get', '/cart', cookie).expect(200)).body.items[0].quantity).toBe(3);

      const { variant: small } = await createProduct(A, { quantity: 2 });
      await call(A, 'post', '/cart/items').send({ variantId: small.id, quantity: 3 }).expect(409);
    });

    it('allows backorder up to 20', async () => {
      const { variant } = await createProduct(A, { quantity: 0, allowBackorder: true });
      const res = await call(A, 'post', '/cart/items').send({ variantId: variant.id, quantity: 20 }).expect(200);
      const cookie = cookieHeader({ sf_cart: cookieValue(res, 'sf_cart') });
      await call(A, 'post', '/cart/items', cookie).send({ variantId: variant.id, quantity: 1 }).expect(409);
    });

    it('rejects out-of-stock, draft, unknown and foreign variants', async () => {
      const out = await createProduct(A, { quantity: 0 });
      const draft = await createProduct(A, { status: 'DRAFT' });
      const foreign = await createProduct(B);

      await call(A, 'post', '/cart/items').send({ variantId: out.variant.id, quantity: 1 }).expect(409);
      await call(A, 'post', '/cart/items').send({ variantId: draft.variant.id, quantity: 1 }).expect(404);
      await call(A, 'post', '/cart/items').send({ variantId: randomUUID(), quantity: 1 }).expect(404);
      await call(A, 'post', '/cart/items').send({ variantId: foreign.variant.id, quantity: 1 }).expect(404);
    });

    it('validates the payload', async () => {
      const { variant } = await createProduct(A);
      for (const body of [
        { variantId: variant.id, quantity: 0 },
        { variantId: variant.id, quantity: -1 },
        { variantId: variant.id, quantity: 21 },
        { variantId: variant.id, quantity: 1.5 },
        { variantId: 'nope', quantity: 1 },
        { variantId: variant.id },
        { variantId: variant.id, quantity: 1, price: 1 },
      ]) {
        await call(A, 'post', '/cart/items').send(body).expect(400);
      }
    });

    it('updates quantities, removes with 0, deletes items and clears the cart', async () => {
      const p1 = await createProduct(A, { price: 100_000 });
      const p2 = await createProduct(A, { price: 50_000 });
      const first = await call(A, 'post', '/cart/items').send({ variantId: p1.variant.id, quantity: 1 }).expect(200);
      const cookie = cookieHeader({ sf_cart: cookieValue(first, 'sf_cart') });
      await call(A, 'post', '/cart/items', cookie).send({ variantId: p2.variant.id, quantity: 1 }).expect(200);

      const set = await call(A, 'patch', `/cart/items/${p1.variant.id}`, cookie).send({ quantity: 4 }).expect(200);
      expect(set.body).toMatchObject({ itemCount: 5, subtotal: 450_000 });

      await call(A, 'patch', `/cart/items/${p1.variant.id}`, cookie).send({ quantity: 99 }).expect(400);
      await call(A, 'patch', `/cart/items/${p1.variant.id}`, cookie).send({ quantity: 20 }).expect(409); // موجودی ۱۰

      const zero = await call(A, 'patch', `/cart/items/${p1.variant.id}`, cookie).send({ quantity: 0 }).expect(200);
      expect(zero.body.items.map((i: { variantId: string }) => i.variantId)).toEqual([p2.variant.id]);

      const removed = await call(A, 'delete', `/cart/items/${p2.variant.id}`, cookie).expect(200);
      expect(removed.body.items).toEqual([]);

      await call(A, 'post', '/cart/items', cookie).send({ variantId: p1.variant.id, quantity: 2 }).expect(200);
      const cleared = await call(A, 'delete', '/cart', cookie).expect(200);
      expect(cleared.body.items).toEqual([]);
    });

    it('returns 404 when changing an item that is not in the cart', async () => {
      const { variant } = await createProduct(A);
      await call(A, 'patch', `/cart/items/${variant.id}`).send({ quantity: 2 }).expect(404);
    });

    it('recomputes prices and flags problems on every view', async () => {
      const ok = await createProduct(A, { price: 100_000, quantity: 10 });
      const willArchive = await createProduct(A, { price: 70_000, quantity: 10 });
      const willRunLow = await createProduct(A, { price: 30_000, quantity: 10 });

      const r = await call(A, 'post', '/cart/items').send({ variantId: ok.variant.id, quantity: 2 }).expect(200);
      const cookie = cookieHeader({ sf_cart: cookieValue(r, 'sf_cart') });
      await call(A, 'post', '/cart/items', cookie).send({ variantId: willArchive.variant.id, quantity: 1 }).expect(200);
      await call(A, 'post', '/cart/items', cookie).send({ variantId: willRunLow.variant.id, quantity: 5 }).expect(200);

      await prisma.variant.update({ where: { id: ok.variant.id }, data: { price: 120_000 } });
      await prisma.product.update({ where: { id: willArchive.product.id }, data: { status: 'ARCHIVED' } });
      await prisma.inventory.updateMany({ where: { variantId: willRunLow.variant.id }, data: { quantity: 2 } });

      const view = await call(A, 'get', '/cart', cookie).expect(200);
      const byVariant = Object.fromEntries(
        (view.body.items as Array<{ variantId: string }>).map((i) => [i.variantId, i]),
      );

      expect(byVariant[ok.variant.id]).toMatchObject({ unitPrice: 120_000, lineTotal: 240_000, issue: null });
      expect(byVariant[willArchive.variant.id]).toMatchObject({ issue: 'UNAVAILABLE' });
      expect(byVariant[willRunLow.variant.id]).toMatchObject({ issue: 'INSUFFICIENT_STOCK', maxQuantity: 2 });

      expect(view.body.hasIssues).toBe(true);
      expect(view.body.subtotal).toBe(240_000); // فقط آیتم بدون مشکل
      expect(view.body.itemCount).toBe(8);
    });

    it('keeps guest carts separate between stores', async () => {
      const { variant } = await createProduct(A);
      const res = await call(A, 'post', '/cart/items').send({ variantId: variant.id, quantity: 1 }).expect(200);
      const cookie = cookieHeader({ sf_cart: cookieValue(res, 'sf_cart') });

      const onB = await call(B, 'get', '/cart', cookie).expect(200);
      expect(onB.body.items).toEqual([]);
    });
  });

  describe('as a customer', () => {
    it('stores the cart on the account without a guest cookie', async () => {
      const { variant } = await createProduct(A);
      const { cookie } = await login(A, uniquePhone());

      const res = await call(A, 'post', '/cart/items', cookie).send({ variantId: variant.id, quantity: 2 }).expect(200);
      expect(cookieLine(res, 'sf_cart')).toBeUndefined();

      // مرورگر دیگر (ورود تازه) همان سبد را می‌بیند
    });

    it('persists across logins from another browser', async () => {
      const phone = uniquePhone();
      const { variant } = await createProduct(A);
      const first = await login(A, phone);
      await call(A, 'post', '/cart/items', first.cookie).send({ variantId: variant.id, quantity: 3 }).expect(200);

      const second = await login(A, phone);
      const view = await call(A, 'get', '/cart', second.cookie).expect(200);
      expect(view.body.items).toHaveLength(1);
      expect(view.body.items[0].quantity).toBe(3);
    });

    it('does not share a cart between customers', async () => {
      const { variant } = await createProduct(A);
      const one = await login(A, uniquePhone());
      const two = await login(A, uniquePhone());

      await call(A, 'post', '/cart/items', one.cookie).send({ variantId: variant.id, quantity: 1 }).expect(200);
      expect((await call(A, 'get', '/cart', two.cookie).expect(200)).body.items).toEqual([]);
    });
  });

  describe('merging the guest cart on login', () => {
    it('hands the guest cart to a customer who had none', async () => {
      const { variant } = await createProduct(A);
      const guest = await call(A, 'post', '/cart/items').send({ variantId: variant.id, quantity: 2 }).expect(200);
      const guestCookie = cookieHeader({ sf_cart: cookieValue(guest, 'sf_cart') });

      const { res, cookie } = await login(A, uniquePhone(), guestCookie);

      // کوکی مهمان پاک شد و سبد در حساب است
      expect(cookieLine(res, 'sf_cart')).toMatch(/Expires=Thu, 01 Jan 1970/);
      const view = await call(A, 'get', '/cart', cookie).expect(200);
      expect(view.body).toMatchObject({ itemCount: 2 });

      // توکن مهمان دیگر به سبدی نمی‌رسد
      expect((await call(A, 'get', '/cart', guestCookie).expect(200)).body.items).toEqual([]);
    });

    it('merges quantities when the customer already had a cart', async () => {
      const phone = uniquePhone();
      const shared = await createProduct(A, { price: 100_000, quantity: 50 });
      const onlyMine = await createProduct(A, { price: 10_000 });
      const onlyGuest = await createProduct(A, { price: 20_000 });

      const mine = await login(A, phone);
      await call(A, 'post', '/cart/items', mine.cookie).send({ variantId: shared.variant.id, quantity: 15 }).expect(200);
      await call(A, 'post', '/cart/items', mine.cookie).send({ variantId: onlyMine.variant.id, quantity: 1 }).expect(200);

      const guest = await call(A, 'post', '/cart/items').send({ variantId: shared.variant.id, quantity: 10 }).expect(200);
      const guestCookie = cookieHeader({ sf_cart: cookieValue(guest, 'sf_cart') });
      await call(A, 'post', '/cart/items', guestCookie).send({ variantId: onlyGuest.variant.id, quantity: 2 }).expect(200);

      const again = await login(A, phone, guestCookie);
      const view = await call(A, 'get', '/cart', again.cookie).expect(200);
      const qty = Object.fromEntries(
        (view.body.items as Array<{ variantId: string; quantity: number }>).map((i) => [i.variantId, i.quantity]),
      );

      expect(qty[shared.variant.id]).toBe(20); // ۱۵ + ۱۰ با سقف ۲۰
      expect(qty[onlyMine.variant.id]).toBe(1);
      expect(qty[onlyGuest.variant.id]).toBe(2);
      expect(await prisma.cart.count({ where: { tenantId: A.tenant.id, tokenHash: { not: null } } })).toBe(
        await prisma.cart.count({ where: { tenantId: A.tenant.id, customerId: null } }),
      );
    });

    it('ignores a stale or foreign guest cookie', async () => {
      const { variant } = await createProduct(B);
      const guestOnB = await call(B, 'post', '/cart/items').send({ variantId: variant.id, quantity: 1 }).expect(200);
      const foreignCookie = cookieHeader({ sf_cart: cookieValue(guestOnB, 'sf_cart') });

      const { cookie } = await login(A, uniquePhone(), foreignCookie);
      expect((await call(A, 'get', '/cart', cookie).expect(200)).body.items).toEqual([]);

      // سبد مهمان فروشگاه B دست‌نخورده است
      expect((await call(B, 'get', '/cart', foreignCookie).expect(200)).body.items).toHaveLength(1);
    });
  });
});