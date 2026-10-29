import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MaintenanceService } from '../../src/maintenance/maintenance.service';
import { NOTIFICATIONS_QUEUE } from '../../src/notifications/notifications.constants';
import { ZARINPAL_API, type ZarinpalApi } from '../../src/payments/gateway/zarinpal.types';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { ConsoleSmsDriver } from '../../src/sms/drivers/console.driver';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, subdomainHost, type TenantFixture } from '../helpers/fixtures';
import { placeOrder, type OrderKit } from '../helpers/orders';
import { createProduct, shopClient } from '../helpers/shop';

const MERCHANT = '11111111-1111-4111-8111-111111111111';
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const ago = (ms: number) => new Date(Date.now() - ms);

describe('Maintenance jobs', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let queue: Queue;
  let maintenance: MaintenanceService;
  let gateway: ZarinpalApi;
  let A: TenantFixture;
  let B: TenantFixture;
  let kitA: OrderKit;
  let kitB: OrderKit;

  const stock = async (variantId: string) =>
    (await prisma.inventory.findFirstOrThrow({ where: { variantId } })).quantity;
  const orderRow = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });

  /** سفارش + شروع پرداخت (authority در درگاه جعلی ساخته می‌شود)؛ پرداخت به گذشته منتقل می‌شود */
  async function orderWithPayment(minutesAgo: number) {
    const placed = await placeOrder(kitA);
    await kitA.shop.call(A, 'post', `/orders/${placed.order.number}/pay`, placed.c.cookie).expect(200);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: placed.order.id } });
    await prisma.payment.update({ where: { id: payment.id }, data: { createdAt: ago(minutesAgo * MINUTE) } });
    return { ...placed, payment };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    queue = app.get<Queue>(getQueueToken(NOTIFICATIONS_QUEUE));
    maintenance = app.get(MaintenanceService);
    gateway = app.get<ZarinpalApi>(ZARINPAL_API);
    const sms = app.get(ConsoleSmsDriver);

    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');
    const [mA, mB] = await Promise.all([
      prisma.shippingMethod.create({ data: { tenantId: A.tenant.id, title: 'پست', fee: 50_000 } }),
      prisma.shippingMethod.create({ data: { tenantId: B.tenant.id, title: 'پست', fee: 50_000 } }),
    ]);
    const shop = shopClient(app, redis, sms);
    kitA = { prisma, shop, tenant: A, methodId: mA.id };
    kitB = { prisma, shop, tenant: B, methodId: mB.id };

    const token = await app.get(JwtService, { strict: false }).signAsync({
      sub: A.owner.id,
      tenantId: A.tenant.id,
      role: 'OWNER',
    });
    await request(app.getHttpServer())
      .put('/api/payment-gateway')
      .set('Authorization', `Bearer ${token}`)
      .send({ merchantId: MERCHANT })
      .expect(200);
  });

  afterEach(() => vi.restoreAllMocks());

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

  // ─────────────────────────── انقضای سفارش ───────────────────────────
  describe('expireOrders', () => {
    it('cancels expired pending orders, frees the stock and leaves the rest alone', async () => {
      const expired = await placeOrder(kitA, { quantity: 10, qty: 3 });
      const fresh = await placeOrder(kitA, { quantity: 10, qty: 2 });
      const paid = await placeOrder(kitA, { quantity: 10, qty: 1 });
      await prisma.order.update({ where: { id: paid.order.id }, data: { status: 'PAID', expiresAt: ago(MINUTE) } });
      await prisma.order.update({ where: { id: expired.order.id }, data: { expiresAt: ago(MINUTE) } });

      const count = await maintenance.expireOrders({ tenantId: A.tenant.id });

      expect(count).toBe(1);
      expect(await orderRow(expired.order.id)).toMatchObject({
        status: 'CANCELED',
        cancelReason: 'EXPIRED',
        expiresAt: null,
      });
      expect(await stock(expired.variant.id)).toBe(10);
      expect((await orderRow(fresh.order.id)).status).toBe('PENDING');
      expect(await stock(fresh.variant.id)).toBe(8);
      expect((await orderRow(paid.order.id)).status).toBe('PAID');
    });

    it('is idempotent and restores stock only once', async () => {
      const { order, variant } = await placeOrder(kitA, { quantity: 10, qty: 4 });
      await prisma.order.update({ where: { id: order.id }, data: { expiresAt: ago(MINUTE) } });

      expect(await maintenance.expireOrders({ tenantId: A.tenant.id })).toBe(1);
      expect(await maintenance.expireOrders({ tenantId: A.tenant.id })).toBe(0);
      expect(await stock(variant.id)).toBe(10);
    });

    it('works inside the right store only', async () => {
      const a = await placeOrder(kitA);
      const b = await placeOrder(kitB);
      await prisma.order.updateMany({ where: { id: { in: [a.order.id, b.order.id] } }, data: { expiresAt: ago(MINUTE) } });

      await maintenance.expireOrders({ tenantId: A.tenant.id });
      expect((await orderRow(a.order.id)).status).toBe('CANCELED');
      expect((await orderRow(b.order.id)).status).toBe('PENDING');

      await maintenance.expireOrders({ tenantId: B.tenant.id });
      expect((await orderRow(b.order.id)).status).toBe('CANCELED');
    });
  });

  // ─────────────────────────── تطبیق پرداخت ───────────────────────────
  describe('reconcilePayments', () => {
    it('confirms a payment whose customer never came back', async () => {
      const { order, payment } = await orderWithPayment(10);

      const result = await maintenance.reconcilePayments({ tenantId: A.tenant.id });

      expect(result.paid).toBeGreaterThanOrEqual(1);
      expect(await orderRow(order.id)).toMatchObject({ status: 'PAID', expiresAt: null });
      expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
        status: 'PAID',
        gatewayCode: 100,
      });
      // اعلان پرداخت هم صف می‌شود
      expect(await queue.getJob(`paid-customer-sms-${order.id}`)).toBeTruthy();
    });

    it('leaves very recent payments alone (the customer may still be at the bank)', async () => {
      const { order, payment } = await orderWithPayment(1);
      await maintenance.reconcilePayments({ tenantId: A.tenant.id });

      expect((await orderRow(order.id)).status).toBe('PENDING');
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('INITIATED');
    });

    it('ignores payments older than the gateway session', async () => {
      const { order } = await orderWithPayment(90);
      const spy = vi.spyOn(gateway, 'verify');
      await maintenance.reconcilePayments({ tenantId: A.tenant.id });

      expect(spy).not.toHaveBeenCalled();
      expect((await orderRow(order.id)).status).toBe('PENDING');
    });

    it('does not re-check payments the customer canceled at the bank', async () => {
      const { payment } = await orderWithPayment(10);
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureReason: 'CANCELED_OR_FAILED_AT_GATEWAY' },
      });
      const spy = vi.spyOn(gateway, 'verify');

      await maintenance.reconcilePayments({ tenantId: A.tenant.id });
      expect(spy).not.toHaveBeenCalled();
    });

    it('marks unknown authorities as failed, then keeps retrying them within the window', async () => {
      const { order } = await placeOrder(kitA);
      const payment = await prisma.payment.create({
        data: {
          tenantId: A.tenant.id,
          orderId: order.id,
          provider: 'ZARINPAL',
          amount: order.total,
          authority: `A${randomUUID().replace(/-/g, '').slice(0, 30)}`,
          createdAt: ago(10 * MINUTE),
        },
      });
      const spy = vi.spyOn(gateway, 'verify');

      await maintenance.reconcilePayments({ tenantId: A.tenant.id });
      expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
        status: 'FAILED',
        failureReason: 'VERIFY_REJECTED',
        gatewayCode: -54,
      });
      expect((await orderRow(order.id)).status).toBe('PENDING');

      await maintenance.reconcilePayments({ tenantId: A.tenant.id });
      expect(spy.mock.calls.filter(([i]) => i.authority === payment.authority)).toHaveLength(2);
    });

    it('skips orders that are no longer pending', async () => {
      const { c, order } = await orderWithPayment(10);
      await kitA.shop.call(A, 'post', `/orders/${order.number}/cancel`, c.cookie).expect(200);
      const spy = vi.spyOn(gateway, 'verify');

      await maintenance.reconcilePayments({ tenantId: A.tenant.id });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────── پاکسازی ───────────────────────────
  describe('cleanup', () => {
    it('removes expired sessions, old refresh tokens and abandoned guest carts only', async () => {
      const tenantId = A.tenant.id;
      const customer = await prisma.customer.create({ data: { tenantId, phone: `0916${Math.floor(1_000_000 + Math.random() * 8_999_999)}` } });
      const { variant } = await createProduct(prisma, A);

      const session = (expiresAt: Date) =>
        prisma.customerSession.create({
          data: { tenantId, customerId: customer.id, tokenHash: randomUUID(), expiresAt },
        });
      const expiredSession = await session(ago(MINUTE));
      const liveSession = await session(new Date(Date.now() + DAY));

      const refresh = (expiresAt: Date) =>
        prisma.refreshToken.create({
          data: { userId: A.owner.id, familyId: randomUUID(), tokenHash: randomUUID(), expiresAt },
        });
      const oldToken = await refresh(ago(2 * DAY));
      const recentExpired = await refresh(ago(MINUTE));
      const liveToken = await refresh(new Date(Date.now() + DAY));

      const cart = (opts: { createdAt: Date; itemAt?: Date; customerId?: string }) =>
        prisma.cart.create({
          data: {
            tenantId,
            customerId: opts.customerId ?? null,
            tokenHash: opts.customerId ? null : randomUUID(),
            createdAt: opts.createdAt,
            updatedAt: opts.createdAt,
            ...(opts.itemAt
              ? {
                  items: {
                    create: {
                      tenantId,
                      variantId: variant.id,
                      quantity: 1,
                      createdAt: opts.itemAt,
                      updatedAt: opts.itemAt,
                    },
                  },
                }
              : {}),
          },
        });
      const abandoned = await cart({ createdAt: ago(40 * DAY), itemAt: ago(40 * DAY) });
      const emptyOld = await cart({ createdAt: ago(40 * DAY) });
      const stillUsed = await cart({ createdAt: ago(40 * DAY), itemAt: ago(DAY) });
      const fresh = await cart({ createdAt: ago(DAY), itemAt: ago(DAY) });
      const customerCart = await cart({ createdAt: ago(60 * DAY), itemAt: ago(60 * DAY), customerId: customer.id });

      const result = await maintenance.cleanup();
      expect(result.sessions).toBeGreaterThanOrEqual(1);
      expect(result.refreshTokens).toBeGreaterThanOrEqual(1);
      expect(result.guestCarts).toBeGreaterThanOrEqual(2);

      const exists = async (model: 'customerSession' | 'refreshToken' | 'cart', id: string) =>
        (await (prisma[model] as unknown as { count: (a: object) => Promise<number> }).count({ where: { id } })) === 1;

      expect(await exists('customerSession', expiredSession.id)).toBe(false);
      expect(await exists('customerSession', liveSession.id)).toBe(true);
      expect(await exists('refreshToken', oldToken.id)).toBe(false);
      expect(await exists('refreshToken', recentExpired.id)).toBe(true);
      expect(await exists('refreshToken', liveToken.id)).toBe(true);
      expect(await exists('cart', abandoned.id)).toBe(false);
      expect(await exists('cart', emptyOld.id)).toBe(false);
      expect(await exists('cart', stillUsed.id)).toBe(true);
      expect(await exists('cart', fresh.id)).toBe(true);
      expect(await exists('cart', customerCart.id)).toBe(true);
      expect(await prisma.cartItem.count({ where: { cartId: abandoned.id } })).toBe(0);
    });
  });
});