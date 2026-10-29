import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NOTIFICATIONS_QUEUE } from '../../src/notifications/notifications.constants';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { ConsoleSmsDriver } from '../../src/sms/drivers/console.driver';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, subdomainHost, type TenantFixture } from '../helpers/fixtures';
import { markPaidInDb, placeOrder, type OrderKit } from '../helpers/orders';
import { shopClient } from '../helpers/shop';

describe('Seller order management', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let queue: Queue;
  let A: TenantFixture;
  let B: TenantFixture;
  let kit: OrderKit;
  let owner = '';
  let editor = '';
  let ownerB = '';

  const call = (token: string, method: 'get' | 'post', path: string, body?: object) => {
    const req = request(app.getHttpServer())[method](`/api/orders${path}`).set('Authorization', `Bearer ${token}`);
    return method === 'post' ? req.send(body ?? {}) : req;
  };
  const stock = async (variantId: string) =>
    (await prisma.inventory.findFirstOrThrow({ where: { variantId } })).quantity;
  const jobExists = async (name: string, orderId: string) => Boolean(await queue.getJob(`${name}-${orderId}`));

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    queue = app.get<Queue>(getQueueToken(NOTIFICATIONS_QUEUE));
    const sms = app.get(ConsoleSmsDriver);

    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');
    const method = await prisma.shippingMethod.create({
      data: { tenantId: A.tenant.id, title: 'پست', fee: 50_000 },
    });
    kit = { prisma, shop: shopClient(app, redis, sms), tenant: A, methodId: method.id };

    const jwt = app.get(JwtService, { strict: false });
    const sign = (u: { id: string; tenantId: string; role: string }) =>
      jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });
    owner = await sign(A.owner);
    editor = await sign(A.editor);
    ownerB = await sign(B.owner);
  });

  afterAll(async () => {
    const keys = [
      ...(await redis.keys(`otp:*:${A.tenant.id}:*`)),
      CACHE_PREFIX + subdomainHost(A),
      CACHE_PREFIX + subdomainHost(B),
    ];
    await redis.del(...keys);
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  // ─────────────────────────── لیست و جستجو ───────────────────────────
  describe('listing', () => {
    const placed: Record<string, Awaited<ReturnType<typeof placeOrder>>> = {};

    beforeAll(async () => {
      placed.pending = await placeOrder(kit, { address: { recipientName: 'سارا احمدی' } });
      placed.paid = await placeOrder(kit);
      await markPaidInDb(prisma, placed.paid.order.id);
      placed.canceled = await placeOrder(kit);
      await kit.shop.call(A, 'post', `/orders/${placed.canceled.order.number}/cancel`, placed.canceled.c.cookie).expect(200);
    });

    it('lists newest first with customer and item counts', async () => {
      const res = await call(owner, 'get', '').expect(200);
      expect(res.body.items.map((o: { number: number }) => o.number)).toEqual([
        placed.canceled.order.number,
        placed.paid.order.number,
        placed.pending.order.number,
      ]);
      expect(res.body.items[2]).toMatchObject({
        status: 'PENDING',
        itemCount: 2,
        customerPhone: placed.pending.c.phone,
        recipientName: 'سارا احمدی',
        paidAt: null,
      });
      expect(res.body.meta).toMatchObject({ total: 3, page: 1 });
    });

    it('filters by status', async () => {
      const res = await call(owner, 'get', '?status=PAID').expect(200);
      expect(res.body.items.map((o: { number: number }) => o.number)).toEqual([placed.paid.order.number]);
    });

    it('searches by order number, recipient name and phone', async () => {
      const byNumber = await call(owner, 'get', `?q=${placed.paid.order.number}`).expect(200);
      expect(byNumber.body.items.map((o: { number: number }) => o.number)).toEqual([placed.paid.order.number]);

      const byName = await call(owner, 'get', `?q=${encodeURIComponent('احمدی')}`).expect(200);
      expect(byName.body.items.map((o: { number: number }) => o.number)).toEqual([placed.pending.order.number]);

      const byPhone = await call(owner, 'get', `?q=${placed.canceled.c.phone}`).expect(200);
      expect(byPhone.body.items.map((o: { number: number }) => o.number)).toEqual([placed.canceled.order.number]);

      expect((await call(owner, 'get', '?q=zzzz-not-found').expect(200)).body.items).toEqual([]);
    });

    it('paginates', async () => {
      const res = await call(owner, 'get', '?limit=2&page=2').expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ total: 3, totalPages: 2, page: 2 });
    });

    it('rejects bad filters', async () => {
      await call(owner, 'get', '?status=NOPE').expect(400);
      await call(owner, 'get', '?limit=1000').expect(400);
      await call(owner, 'get', '?page=0').expect(400);
    });

    it('counts orders per status', async () => {
      const res = await call(editor, 'get', '/stats').expect(200);
      expect(res.body).toEqual({ PENDING: 1, PAID: 1, SHIPPED: 0, CANCELED: 1 });
    });

    it('requires a seller token and never shows other stores', async () => {
      await request(app.getHttpServer()).get('/api/orders').expect(401);
      expect((await call(ownerB, 'get', '').expect(200)).body.items).toEqual([]);
      expect((await call(ownerB, 'get', '/stats').expect(200)).body).toEqual({
        PENDING: 0,
        PAID: 0,
        SHIPPED: 0,
        CANCELED: 0,
      });
    });
  });

  // ─────────────────────────── جزئیات ───────────────────────────
  describe('detail', () => {
    it('shows customer, address, items and payments', async () => {
      const { c, order } = await placeOrder(kit, { title: 'تیشرت', qty: 3 });
      const res = await call(editor, 'get', `/${order.number}`).expect(200);

      expect(res.body).toMatchObject({
        number: order.number,
        status: 'PENDING',
        total: order.total,
        customer: { id: c.customerId, phone: c.phone },
        address: { recipientName: 'علی رضایی' },
        payments: [],
      });
      expect(res.body.items[0]).toMatchObject({ productTitle: 'تیشرت', quantity: 3 });
    });

    it('404 for unknown, malformed and foreign orders', async () => {
      const { order } = await placeOrder(kit);
      await call(owner, 'get', '/999999').expect(404);
      await call(owner, 'get', '/99999999999').expect(404);
      await call(owner, 'get', '/abc').expect(400);
      await call(ownerB, 'get', `/${order.number}`).expect(404);
      await call(ownerB, 'post', `/${order.number}/ship`).expect(404);
      await call(ownerB, 'post', `/${order.number}/cancel`).expect(404);
      await call(ownerB, 'post', `/${order.number}/mark-paid`).expect(404);
    });
  });

  // ─────────────────────────── پرداخت دستی ───────────────────────────
  describe('manual payment', () => {
    it('marks a pending order as paid, records the payment and queues notifications', async () => {
      const { order } = await placeOrder(kit);
      const res = await call(owner, 'post', `/${order.number}/mark-paid`, { reference: ' کارت‌به‌کارت ۴۵۶۷ ' }).expect(200);

      expect(res.body).toMatchObject({ status: 'PAID', expiresAt: null });
      expect(res.body.paidAt).not.toBeNull();
      expect(res.body.payments).toEqual([
        expect.objectContaining({ provider: 'MANUAL', status: 'PAID', amount: order.total, refId: 'کارت‌به‌کارت ۴۵۶۷' }),
      ]);

      expect(await jobExists('paid-customer-sms', order.id)).toBe(true);
      expect(await jobExists('paid-seller-email', order.id)).toBe(true);
    });

    it('cannot be done twice or on non-pending orders', async () => {
      const { order } = await placeOrder(kit);
      await call(owner, 'post', `/${order.number}/mark-paid`).expect(200);
      const again = await call(owner, 'post', `/${order.number}/mark-paid`).expect(409);
      expect(again.body.code).toBe('NOT_PAYABLE');
      expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    });

    it('is restricted to owners and admins', async () => {
      const { order } = await placeOrder(kit);
      await call(editor, 'post', `/${order.number}/mark-paid`).expect(403);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
    });

    it('validates the reference', async () => {
      const { order } = await placeOrder(kit);
      await call(owner, 'post', `/${order.number}/mark-paid`, { reference: 'x'.repeat(101) }).expect(400);
      await call(owner, 'post', `/${order.number}/mark-paid`, { foo: 1 }).expect(400);
    });
  });

  // ─────────────────────────── ارسال ───────────────────────────
  describe('shipping', () => {
    it('ships a paid order with a tracking code, which the customer can see', async () => {
      const { c, order } = await placeOrder(kit);
      await markPaidInDb(prisma, order.id);

      const res = await call(editor, 'post', `/${order.number}/ship`, { trackingCode: ' rx-123 456 ' }).expect(200);
      expect(res.body).toMatchObject({ status: 'SHIPPED', trackingCode: 'rx-123 456' });
      expect(res.body.shippedAt).not.toBeNull();
      expect(await jobExists('shipped-customer-sms', order.id)).toBe(true);

      const mine = await kit.shop.call(A, 'get', `/orders/${order.number}`, c.cookie).expect(200);
      expect(mine.body).toMatchObject({ status: 'SHIPPED', trackingCode: 'rx-123 456' });
    });

    it('accepts Persian digits and an empty tracking code', async () => {
      const a = await placeOrder(kit);
      await markPaidInDb(prisma, a.order.id);
      const withPersian = await call(owner, 'post', `/${a.order.number}/ship`, { trackingCode: 'ab۱۲۳' }).expect(200);
      expect(withPersian.body.trackingCode).toBe('ab123');

      const b = await placeOrder(kit);
      await markPaidInDb(prisma, b.order.id);
      expect((await call(owner, 'post', `/${b.order.number}/ship`).expect(200)).body.trackingCode).toBeNull();
    });

    it('refuses unpaid, canceled and already shipped orders', async () => {
      const pending = await placeOrder(kit);
      expect((await call(owner, 'post', `/${pending.order.number}/ship`).expect(409)).body.code).toBe('BAD_TRANSITION');

      const shipped = await placeOrder(kit);
      await markPaidInDb(prisma, shipped.order.id);
      await call(owner, 'post', `/${shipped.order.number}/ship`).expect(200);
      await call(owner, 'post', `/${shipped.order.number}/ship`).expect(409);
      expect(await jobExists('shipped-customer-sms', pending.order.id)).toBe(false);
    });

    it('validates the tracking code', async () => {
      const { order } = await placeOrder(kit);
      await markPaidInDb(prisma, order.id);
      for (const trackingCode of ['ab', '<script>', 'x'.repeat(65), '--bad']) {
        await call(owner, 'post', `/${order.number}/ship`, { trackingCode }).expect(400);
      }
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
    });
  });

  // ─────────────────────────── لغو ───────────────────────────
  describe('canceling', () => {
    it('cancels a pending order and returns the stock', async () => {
      const { order, variant } = await placeOrder(kit, { quantity: 10, qty: 4 });
      expect(await stock(variant.id)).toBe(6);

      const res = await call(owner, 'post', `/${order.number}/cancel`).expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELED', cancelReason: 'SELLER' });
      expect(await stock(variant.id)).toBe(10);
    });

    it('cancels a paid but unshipped order and returns the stock', async () => {
      const { order, variant } = await placeOrder(kit, { quantity: 10, qty: 2 });
      await markPaidInDb(prisma, order.id);

      await call(owner, 'post', `/${order.number}/cancel`).expect(200);
      expect(await stock(variant.id)).toBe(10);
    });

    it('cannot cancel a shipped order or cancel twice', async () => {
      const { order, variant } = await placeOrder(kit, { quantity: 10, qty: 2 });
      await markPaidInDb(prisma, order.id);
      await call(owner, 'post', `/${order.number}/ship`).expect(200);
      await call(owner, 'post', `/${order.number}/cancel`).expect(409);

      const other = await placeOrder(kit, { quantity: 10, qty: 1 });
      await call(owner, 'post', `/${other.order.number}/cancel`).expect(200);
      await call(owner, 'post', `/${other.order.number}/cancel`).expect(409);
      expect(await stock(other.variant.id)).toBe(10);
      expect(await stock(variant.id)).toBe(8);
    });

    it('is restricted to owners and admins', async () => {
      const { order } = await placeOrder(kit);
      await call(editor, 'post', `/${order.number}/cancel`).expect(403);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
    });
  });
});