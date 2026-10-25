import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OrdersService } from '../../src/orders/orders.service';
import { MAX_ADDRESSES, MAX_PENDING_ORDERS } from '../../src/orders/orders.constants';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { ConsoleSmsDriver } from '../../src/sms/drivers/console.driver';
import { TenantContext } from '../../src/tenants/tenant-context';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { createTestApp } from '../helpers/create-app';
import {
  cleanupFixtures,
  createFixture,
  subdomainHost,
  type TenantFixture,
} from '../helpers/fixtures';
import { addressBody, createProduct, shopClient, type ProductOpts } from '../helpers/shop';
import { CartService } from '../../src/customers/cart.service';

describe('Checkout and orders', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let sms: ConsoleSmsDriver;
  let jwt: JwtService;
  let orders: OrdersService;
  let tenantCtx: TenantContext;
  let A: TenantFixture;
  let B: TenantFixture;
  let shop: ReturnType<typeof shopClient>;
  let std: { id: string };
  let express: { id: string };
  let inactive: { id: string };
  let foreignMethod: { id: string };
  let ownerToken = '';
  let editorToken = '';
  let ownerBToken = '';
  const registeredTenants: string[] = [];

  type Client = Awaited<ReturnType<typeof shop.login>>;

  const stock = async (variantId: string) =>
    (await prisma.inventory.findFirstOrThrow({ where: { variantId } })).quantity;
  const sellerReq = (token: string) => (path: string) =>
    request(app.getHttpServer()).get(`/api/${path}`).set('Authorization', `Bearer ${token}`);

  async function addAddress(c: Client, over: Record<string, unknown> = {}, f = A) {
    return (await shop.call(f, 'post', '/addresses', c.cookie).send(addressBody(over)).expect(201))
      .body;
  }
  async function addToCart(c: Client, variantId: string, quantity = 1, f = A) {
    await shop.call(f, 'post', '/cart/items', c.cookie).send({ variantId, quantity }).expect(200);
  }
  /** مشتری تازه با آدرس و یک کالا در سبد */
  async function shopper(productOpts: ProductOpts = {}, quantity = 2) {
    const c = await shop.login(A);
    const address = await addAddress(c);
    const item = await createProduct(prisma, A, productOpts);
    await addToCart(c, item.variant.id, quantity);
    return { c, address, ...item };
  }
  const place = (c: Client, body: Record<string, unknown>, f = A) =>
    shop.call(f, 'post', '/orders', c.cookie).send(body);
  const quoteTotal = async (c: Client, methodId: string) =>
    (
      await shop
        .call(A, 'get', '/checkout/quote', c.cookie)
        .query({ shippingMethodId: methodId })
        .expect(200)
    ).body.total as number;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    sms = app.get(ConsoleSmsDriver);
    jwt = app.get(JwtService, { strict: false });
    orders = app.get(OrdersService);
    tenantCtx = app.get(TenantContext);
    shop = shopClient(app, redis, sms);

    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');

    std = await prisma.shippingMethod.create({
      data: { tenantId: A.tenant.id, title: 'پست', fee: 50_000, position: 1 },
    });
    express = await prisma.shippingMethod.create({
      data: {
        tenantId: A.tenant.id,
        title: 'پیک',
        fee: 90_000,
        freeThreshold: 500_000,
        position: 0,
      },
    });
    inactive = await prisma.shippingMethod.create({
      data: { tenantId: A.tenant.id, title: 'غیرفعال', fee: 1000, isActive: false },
    });
    foreignMethod = await prisma.shippingMethod.create({
      data: { tenantId: B.tenant.id, title: 'روش B', fee: 1000 },
    });

    const sign = (u: { id: string; tenantId: string; role: string }) =>
      jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });
    ownerToken = await sign(A.owner);
    editorToken = await sign(A.editor);
    ownerBToken = await sign(B.owner);
  });

  afterAll(async () => {
    const ids = [A.tenant.id, B.tenant.id];
    const keys = [
      ...(await Promise.all(ids.map((id) => redis.keys(`otp:*:${id}:*`)))).flat(),
      CACHE_PREFIX + subdomainHost(A),
      CACHE_PREFIX + subdomainHost(B),
    ];
    await redis.del(...keys);
    await prisma.tenant.deleteMany({ where: { id: { in: registeredTenants } } });
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  // ─────────────────────────── نشانی‌ها ───────────────────────────
  describe('addresses', () => {
    it('requires a logged-in customer', async () => {
      await shop.call(A, 'get', '/addresses').expect(401);
      await shop.call(A, 'post', '/addresses').send(addressBody()).expect(401);
    });

    it('makes the first address the default and switches the default on demand', async () => {
      const c = await shop.login(A);
      const first = await addAddress(c);
      const second = await addAddress(c, { city: 'کرج' });
      expect(first.isDefault).toBe(true);
      expect(second.isDefault).toBe(false);

      await shop
        .call(A, 'patch', `/addresses/${second.id}`, c.cookie)
        .send({ isDefault: true })
        .expect(200);
      const list = (await shop.call(A, 'get', '/addresses', c.cookie).expect(200)).body;
      expect(list.map((a: { id: string }) => a.id)).toEqual([second.id, first.id]);
      expect(list.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);
    });

    it('normalizes Persian digits and Arabic letters', async () => {
      const c = await shop.login(A);
      const a = await addAddress(c, {
        recipientName: 'علي كريمي',
        recipientPhone: '۰۹۱۲۱۲۳۴۵۶۷',
        postalCode: '۱۲۳۴۵-۶۷۸۹۰',
      });
      expect(a).toMatchObject({
        recipientName: 'علی کریمی',
        recipientPhone: '09121234567',
        postalCode: '1234567890',
      });
    });

    it('validates the payload', async () => {
      const c = await shop.login(A);
      for (const over of [
        { province: 'آتلانتیس' },
        { postalCode: '0123456789' },
        { postalCode: '12345' },
        { address: 'کوتاه' },
        { recipientPhone: '123' },
        { recipientName: 'ع' },
        { city: '' },
        { extra: 1 },
      ]) {
        await shop.call(A, 'post', '/addresses', c.cookie).send(addressBody(over)).expect(400);
      }
    });

    it('limits the number of saved addresses', async () => {
      const c = await shop.login(A);
      for (let i = 0; i < MAX_ADDRESSES; i++) await addAddress(c);
      await shop.call(A, 'post', '/addresses', c.cookie).send(addressBody()).expect(409);
    });

    it('promotes another address when the default is deleted', async () => {
      const c = await shop.login(A);
      const first = await addAddress(c);
      const second = await addAddress(c);
      await shop.call(A, 'delete', `/addresses/${first.id}`, c.cookie).expect(204);
      const list = (await shop.call(A, 'get', '/addresses', c.cookie).expect(200)).body;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: second.id, isDefault: true });
    });

    it("cannot read or change another customer's address", async () => {
      const owner = await shop.login(A);
      const other = await shop.login(A);
      const address = await addAddress(owner);

      expect((await shop.call(A, 'get', '/addresses', other.cookie).expect(200)).body).toEqual([]);
      await shop
        .call(A, 'patch', `/addresses/${address.id}`, other.cookie)
        .send({ city: 'hack' })
        .expect(404);
      await shop.call(A, 'delete', `/addresses/${address.id}`, other.cookie).expect(404);
      expect((await shop.call(A, 'get', '/addresses', owner.cookie).expect(200)).body).toHaveLength(
        1,
      );
    });
  });

  // ─────────────────────────── روش‌های ارسال ───────────────────────────
  describe('shipping methods', () => {
    it('lists only active methods publicly, in order', async () => {
      const res = await shop.call(A, 'get', '/shipping-methods').expect(200);
      expect(res.body.map((m: { id: string }) => m.id)).toEqual([express.id, std.id]);
      expect(res.body[0]).toEqual({
        id: express.id,
        title: 'پیک',
        description: null,
        fee: 90_000,
        freeThreshold: 500_000,
      });
    });

    it('lets the owner manage methods and keeps an editor read-only', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/shipping-methods')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'تیپاکس', fee: 70_000, freeThreshold: 2_000_000, description: 'سه روزه' })
        .expect(201);
      expect(created.body).toMatchObject({ title: 'تیپاکس', fee: 70_000, isActive: true });

      await request(app.getHttpServer())
        .post('/api/shipping-methods')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ title: 'x y', fee: 1 })
        .expect(403);

      expect(
        (await sellerReq(editorToken)('shipping-methods').expect(200)).body.length,
      ).toBeGreaterThan(3);

      const patched = await request(app.getHttpServer())
        .patch(`/api/shipping-methods/${created.body.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ fee: 80_000, freeThreshold: null, isActive: false })
        .expect(200);
      expect(patched.body).toMatchObject({ fee: 80_000, freeThreshold: null, isActive: false });

      // غیرفعال: از ویترین ناپدید می‌شود
      const publicList = (await shop.call(A, 'get', '/shipping-methods').expect(200)).body;
      expect(publicList.some((m: { id: string }) => m.id === created.body.id)).toBe(false);

      await request(app.getHttpServer())
        .delete(`/api/shipping-methods/${created.body.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
    });

    it('validates the payload', async () => {
      for (const body of [
        { title: 'x', fee: 1 },
        { title: 'روش', fee: -1 },
        { title: 'روش', fee: 1.5 },
        { title: 'روش', fee: 1, freeThreshold: 0 },
        { title: 'روش', fee: 1, foo: 1 },
      ]) {
        await request(app.getHttpServer())
          .post('/api/shipping-methods')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send(body)
          .expect(400);
      }
    });

    it('does not expose methods across stores', async () => {
      const listB = (await sellerReq(ownerBToken)('shipping-methods').expect(200)).body;
      expect(listB.map((m: { id: string }) => m.id)).toEqual([foreignMethod.id]);

      await request(app.getHttpServer())
        .patch(`/api/shipping-methods/${std.id}`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .send({ fee: 1 })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/api/shipping-methods/${std.id}`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .expect(404);
    });

    it('gives every newly registered store a default method', async () => {
      const n = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          storeName: 'فروشگاه جدید',
          subdomain: `reg${n}`,
          name: 'مالک جدید',
          email: `reg${n}@test.dev`,
          password: 'Password123!',
        })
        .expect(201);
      registeredTenants.push(res.body.tenant.id);

      const methods = await prisma.shippingMethod.findMany({
        where: { tenantId: res.body.tenant.id },
      });
      expect(methods).toHaveLength(1);
      expect(methods[0]).toMatchObject({ fee: 50_000, isActive: true });
    });
  });

  // ─────────────────────────── پیش‌نمایش مبلغ ───────────────────────────
  describe('quote', () => {
    it('computes totals on the server', async () => {
      const { c } = await shopper({ price: 100_000 }, 2);
      const res = await shop
        .call(A, 'get', '/checkout/quote', c.cookie)
        .query({ shippingMethodId: std.id })
        .expect(200);
      expect(res.body).toEqual({
        itemCount: 2,
        subtotal: 200_000,
        shippingFee: 50_000,
        total: 250_000,
        freeShipping: false,
        hasIssues: false,
      });
    });

    it('applies free shipping from the threshold', async () => {
      const { c } = await shopper({ price: 300_000 }, 2);
      const res = await shop
        .call(A, 'get', '/checkout/quote', c.cookie)
        .query({ shippingMethodId: express.id })
        .expect(200);
      expect(res.body).toMatchObject({
        subtotal: 600_000,
        shippingFee: 0,
        total: 600_000,
        freeShipping: true,
      });
    });

    it('excludes unavailable items and flags the problem', async () => {
      const { c, product } = await shopper({ price: 100_000 }, 1);
      const other = await createProduct(prisma, A, { price: 40_000 });
      await addToCart(c, other.variant.id, 1);
      await prisma.product.update({ where: { id: product.id }, data: { status: 'ARCHIVED' } });

      const res = await shop
        .call(A, 'get', '/checkout/quote', c.cookie)
        .query({ shippingMethodId: std.id })
        .expect(200);
      expect(res.body).toMatchObject({ subtotal: 40_000, hasIssues: true });
    });

    it('rejects unknown, inactive and foreign methods, and needs a login', async () => {
      const { c } = await shopper();
      for (const id of [inactive.id, foreignMethod.id, randomUUID()]) {
        await shop
          .call(A, 'get', '/checkout/quote', c.cookie)
          .query({ shippingMethodId: id })
          .expect(400);
      }
      await shop.call(A, 'get', '/checkout/quote').query({ shippingMethodId: std.id }).expect(401);
    });
  });

  // ─────────────────────────── ثبت سفارش ───────────────────────────
  describe('placing an order', () => {
    it('creates a pending order with a server-side price, snapshot, reserved stock and an empty cart', async () => {
      const { c, address, variant } = await shopper(
        { title: 'تیشرت', price: 100_000, quantity: 10 },
        2,
      );
      const total = await quoteTotal(c, std.id);

      const res = await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: total,
        note: ' زنگ بزنید ',
      }).expect(201);

      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toMatchObject({
        status: 'PENDING',
        subtotal: 200_000,
        shippingFee: 50_000,
        total: 250_000,
        shippingTitle: 'پست',
        note: 'زنگ بزنید',
        paidAt: null,
        address: { recipientName: 'علی رضایی', province: 'تهران', postalCode: '1234567890' },
      });
      expect(res.body.number).toBeGreaterThanOrEqual(1001);
      expect(res.body.items).toEqual([
        expect.objectContaining({
          productTitle: 'تیشرت',
          unitPrice: 100_000,
          quantity: 2,
          lineTotal: 200_000,
        }),
      ]);

      const minutes = (new Date(res.body.expiresAt).getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(29);
      expect(minutes).toBeLessThanOrEqual(30);

      expect(await stock(variant.id)).toBe(8);
      expect((await shop.call(A, 'get', '/cart', c.cookie).expect(200)).body.items).toEqual([]);
    });

    it('numbers orders sequentially per store', async () => {
      const one = await shopper();
      const a = await place(one.c, {
        addressId: one.address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(one.c, std.id),
      }).expect(201);

      const two = await shopper();
      const b = await place(two.c, {
        addressId: two.address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(two.c, std.id),
      }).expect(201);

      expect(b.body.number).toBe(a.body.number + 1);
    });

    it('keeps the order unchanged when products, prices or addresses change later', async () => {
      const { c, address, variant, product } = await shopper({ title: 'اولیه', price: 100_000 }, 1);
      const res = await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(c, std.id),
      }).expect(201);

      await prisma.variant.update({ where: { id: variant.id }, data: { price: 999_000 } });
      await prisma.product.update({ where: { id: product.id }, data: { title: 'عوض شد' } });
      await shop
        .call(A, 'patch', `/addresses/${address.id}`, c.cookie)
        .send({ city: 'شیراز' })
        .expect(200);
      await prisma.shippingMethod.update({ where: { id: std.id }, data: { title: 'پست جدید' } });
      await prisma.shippingMethod.update({ where: { id: std.id }, data: { title: 'پست' } });

      const again = (await shop.call(A, 'get', `/orders/${res.body.number}`, c.cookie).expect(200))
        .body;
      expect(again.items[0]).toMatchObject({ productTitle: 'اولیه', unitPrice: 100_000 });
      expect(again.address.city).toBe('تهران');
      expect(again.shippingTitle).toBe('پست');
      expect(again.total).toBe(150_000);
    });

    it('refuses an order when the displayed total is stale', async () => {
      const { c, address, variant } = await shopper({ price: 100_000 }, 1);
      const shown = await quoteTotal(c, std.id);
      await prisma.variant.update({ where: { id: variant.id }, data: { price: 120_000 } });

      const res = await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: shown,
      }).expect(409);
      expect(res.body).toMatchObject({ code: 'PRICE_CHANGED', total: 170_000 });

      expect(await stock(variant.id)).toBe(10);
      expect((await shop.call(A, 'get', '/cart', c.cookie).expect(200)).body.items).toHaveLength(1);
      expect(await prisma.order.count({ where: { customerId: c.customerId } })).toBe(0);
    });

    it('ignores any attempt to send a client-side price', async () => {
      const { c, address } = await shopper();
      await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: 1,
        total: 1,
        subtotal: 1,
      }).expect(400);
      await place(c, { addressId: address.id, shippingMethodId: std.id, expectedTotal: 1 }).expect(
        409,
      );
    });

    it('rejects an empty cart and a cart with unavailable items', async () => {
      const empty = await shop.login(A);
      const address = await addAddress(empty);
      await place(empty, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: 0,
      }).expect(400);

      const { c, address: a2, product } = await shopper();
      await prisma.product.update({ where: { id: product.id }, data: { status: 'ARCHIVED' } });
      const res = await place(c, {
        addressId: a2.id,
        shippingMethodId: std.id,
        expectedTotal: 0,
      }).expect(409);
      expect(res.body.code).toBe('CART_ISSUES');
    });

    it('rejects foreign or unknown addresses and methods', async () => {
      const { c, address } = await shopper();
      const stranger = await shop.login(A);
      const strangerAddress = await addAddress(stranger);
      const total = await quoteTotal(c, std.id);

      await place(c, {
        addressId: strangerAddress.id,
        shippingMethodId: std.id,
        expectedTotal: total,
      }).expect(400);
      await place(c, {
        addressId: randomUUID(),
        shippingMethodId: std.id,
        expectedTotal: total,
      }).expect(400);
      await place(c, {
        addressId: address.id,
        shippingMethodId: foreignMethod.id,
        expectedTotal: total,
      }).expect(400);
      await place(c, {
        addressId: address.id,
        shippingMethodId: inactive.id,
        expectedTotal: total,
      }).expect(400);
    });

    it('validates the payload', async () => {
      const { c, address } = await shopper();
      for (const body of [
        {},
        { addressId: address.id, shippingMethodId: std.id },
        { addressId: 'x', shippingMethodId: std.id, expectedTotal: 1 },
        { addressId: address.id, shippingMethodId: std.id, expectedTotal: -1 },
        { addressId: address.id, shippingMethodId: std.id, expectedTotal: 1.5 },
        {
          addressId: address.id,
          shippingMethodId: std.id,
          expectedTotal: 1,
          note: 'x'.repeat(501),
        },
      ]) {
        await place(c, body).expect(400);
      }
    });

    it('requires a login', async () => {
      await shop.call(A, 'post', '/orders').send({}).expect(401);
    });

    it('limits unpaid orders per customer', async () => {
      const c = await shop.login(A);
      const address = await addAddress(c);
      const item = await createProduct(prisma, A, { price: 10_000, quantity: 50 });

      for (let i = 0; i < MAX_PENDING_ORDERS; i++) {
        await addToCart(c, item.variant.id);
        await place(c, {
          addressId: address.id,
          shippingMethodId: std.id,
          expectedTotal: await quoteTotal(c, std.id),
        }).expect(201);
      }

      await addToCart(c, item.variant.id);
      const res = await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(c, std.id),
      }).expect(409);
      expect(res.body.code).toBe('PENDING_LIMIT');
    });
  });

  // ─────────────────────────── موجودی ───────────────────────────
  describe('stock', () => {
    it('never oversells the last unit under concurrency', async () => {
      const item = await createProduct(prisma, A, { price: 100_000, quantity: 1 });
      const buyers = await Promise.all([shop.login(A), shop.login(A)]);
      const prepared = await Promise.all(
        buyers.map(async (c) => {
          const address = await addAddress(c);
          await addToCart(c, item.variant.id, 1);
          return { c, address, total: await quoteTotal(c, std.id) };
        }),
      );

      const results = await Promise.all(
        prepared.map((p) =>
          place(p.c, { addressId: p.address.id, shippingMethodId: std.id, expectedTotal: p.total }),
        ),
      );

    

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      // بازنده بسته به زمان‌بندی یا در بررسی سبد یا در کسر اتمیک موجودی رد می‌شود؛ هر دو درست‌اند
      expect(['OUT_OF_STOCK', 'CART_ISSUES']).toContain(
        results.find((r) => r.status === 409)!.body.code,
      );
      expect(await stock(item.variant.id)).toBe(0);
      expect(await prisma.orderItem.count({ where: { variantId: item.variant.id } })).toBe(1);
        it('refuses atomically when the stock vanishes after the cart was read', async () => {
        const { c, address, variant } = await shopper({ quantity: 5 }, 2);
        const total = await quoteTotal(c, std.id);

        // سبدی که سرور قبل از کم‌شدن موجودی خوانده است
        const snapshot = (await shop.call(A, 'get', '/cart', c.cookie).expect(200)).body;
        await prisma.inventory.updateMany({
          where: { variantId: variant.id },
          data: { quantity: 1 },
        });
        const spy = vi
          .spyOn(app.get(CartService, { strict: false }), 'view')
          .mockResolvedValueOnce(snapshot);

        const res = await place(c, {
          addressId: address.id,
          shippingMethodId: std.id,
          expectedTotal: total,
        }).expect(409);
        spy.mockRestore();

        expect(res.body.code).toBe('OUT_OF_STOCK');
        expect(await stock(variant.id)).toBe(1); // کم نشده و منفی هم نشده
        expect(await prisma.order.count({ where: { customerId: c.customerId } })).toBe(0);
        expect((await shop.call(A, 'get', '/cart', c.cookie).expect(200)).body.items).toHaveLength(
          1,
        );
      });
    });

    it('allows backorder to go negative and gives it back on cancel', async () => {
      const { c, address, variant } = await shopper({ quantity: 0, allowBackorder: true }, 3);
      const res = await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(c, std.id),
      }).expect(201);
      expect(await stock(variant.id)).toBe(-3);

      await shop.call(A, 'post', `/orders/${res.body.number}/cancel`, c.cookie).expect(200);
      expect(await stock(variant.id)).toBe(0);
    });
  });

  // ─────────────────────────── مشاهده و لغو ───────────────────────────
  describe('viewing and canceling', () => {
    it('lists own orders newest first with item counts and thumbnails', async () => {
      const c = await shop.login(A);
      const address = await addAddress(c);
      const item = await createProduct(prisma, A, { price: 10_000, quantity: 50 });

      const numbers: number[] = [];
      for (const qty of [1, 3]) {
        await addToCart(c, item.variant.id, qty);
        const res = await place(c, {
          addressId: address.id,
          shippingMethodId: std.id,
          expectedTotal: await quoteTotal(c, std.id),
        }).expect(201);
        numbers.push(res.body.number);
      }

      const list = (await shop.call(A, 'get', '/orders', c.cookie).expect(200)).body;
      expect(list.items.map((o: { number: number }) => o.number)).toEqual([numbers[1], numbers[0]]);
      expect(list.items.map((o: { itemCount: number }) => o.itemCount)).toEqual([3, 1]);
      expect(list.meta).toMatchObject({ total: 2, page: 1 });
    });

    it("hides other customers' and other stores' orders", async () => {
      const { c, address } = await shopper();
      const res = await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(c, std.id),
      }).expect(201);

      const other = await shop.login(A);
      await shop.call(A, 'get', `/orders/${res.body.number}`, other.cookie).expect(404);
      await shop.call(A, 'post', `/orders/${res.body.number}/cancel`, other.cookie).expect(404);
      expect((await shop.call(A, 'get', '/orders', other.cookie).expect(200)).body.items).toEqual(
        [],
      );

      await shop.call(B, 'get', `/orders/${res.body.number}`, c.cookie).expect(401);
    });

    it('answers 404 or 400 for unknown or malformed numbers', async () => {
      const c = await shop.login(A);
      await shop.call(A, 'get', '/orders/999999', c.cookie).expect(404);
      await shop.call(A, 'get', '/orders/99999999999', c.cookie).expect(404);
      await shop.call(A, 'get', '/orders/abc', c.cookie).expect(400);
    });

    it('cancels a pending order once and returns the reserved stock once', async () => {
      const { c, address, variant } = await shopper({ quantity: 10 }, 4);
      const res = await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(c, std.id),
      }).expect(201);
      expect(await stock(variant.id)).toBe(6);

      const canceled = await shop
        .call(A, 'post', `/orders/${res.body.number}/cancel`, c.cookie)
        .expect(200);
      expect(canceled.body).toMatchObject({
        status: 'CANCELED',
        cancelReason: 'CUSTOMER',
        expiresAt: null,
      });
      expect(await stock(variant.id)).toBe(10);

      const again = await shop
        .call(A, 'post', `/orders/${res.body.number}/cancel`, c.cookie)
        .expect(409);
      expect(again.body.code).toBe('NOT_CANCELABLE');
      expect(await stock(variant.id)).toBe(10);
    });

    it('does not let the customer cancel a paid order', async () => {
      const { c, address, variant } = await shopper({ quantity: 10 }, 2);
      const res = await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(c, std.id),
      }).expect(201);
      await prisma.order.update({ where: { id: res.body.id }, data: { status: 'PAID' } });

      await shop.call(A, 'post', `/orders/${res.body.number}/cancel`, c.cookie).expect(409);
      expect(await stock(variant.id)).toBe(8);
    });

    it('releases expired reservations on the next checkout', async () => {
      const first = await shopper({ quantity: 5 }, 5);
      const res = await place(first.c, {
        addressId: first.address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(first.c, std.id),
      }).expect(201);
      expect(await stock(first.variant.id)).toBe(0);

      await prisma.order.update({
        where: { id: res.body.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      // سفارش دیگری در همین فروشگاه ثبت می‌شود و کالای منقضی را آزاد می‌کند
      const second = await shopper();
      await place(second.c, {
        addressId: second.address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(second.c, std.id),
      }).expect(201);

      const old = await prisma.order.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(old).toMatchObject({ status: 'CANCELED', cancelReason: 'EXPIRED', expiresAt: null });
      expect(await stock(first.variant.id)).toBe(5);
    });

    it('moves through the status machine exactly once per transition', async () => {
      const { c, address, variant } = await shopper({ quantity: 10 }, 3);
      const res = await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(c, std.id),
      }).expect(201);
      const id = res.body.id as string;
      const run = <T>(fn: () => Promise<T>) => tenantCtx.runAs(A.tenant.id, fn);

      await run(() => orders.transition(id, 'PAID'));
      expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toMatchObject({
        status: 'PAID',
        expiresAt: null,
      });

      // تکرار (مثلاً callback دوباره‌ی درگاه) اثری ندارد و خطای کنترل‌شده می‌دهد
      await expect(run(() => orders.transition(id, 'PAID'))).rejects.toMatchObject({ status: 409 });

      await run(() => orders.transition(id, 'SHIPPED', { trackingCode: 'RX123' }));
      const shipped = await prisma.order.findUniqueOrThrow({ where: { id } });
      expect(shipped).toMatchObject({ status: 'SHIPPED', trackingCode: 'RX123' });
      expect(shipped.shippedAt).not.toBeNull();

      await expect(run(() => orders.transition(id, 'CANCELED'))).rejects.toMatchObject({
        status: 409,
      });
      expect(await stock(variant.id)).toBe(7);
    });

    it('returns stock when a paid but unshipped order is canceled by the seller', async () => {
      const { c, address, variant } = await shopper({ quantity: 10 }, 2);
      const res = await place(c, {
        addressId: address.id,
        shippingMethodId: std.id,
        expectedTotal: await quoteTotal(c, std.id),
      }).expect(201);

      await tenantCtx.runAs(A.tenant.id, async () => {
        await orders.transition(res.body.id, 'PAID');
        await orders.transition(res.body.id, 'CANCELED', { reason: 'SELLER' });
      });
      expect(await stock(variant.id)).toBe(10);
    });
  });
});
