import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { OrdersService } from '../../src/orders/orders.service';
import { MAX_PAYMENT_ATTEMPTS, PAYMENT_HOLD_MINUTES } from '../../src/payments/payments.constants';
import {
  GatewayUnavailableError,
  ZARINPAL_API,
  type ZarinpalApi,
} from '../../src/payments/gateway/zarinpal.types';
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
import { addressBody, createProduct, shopClient } from '../helpers/shop';
import { PaymentGatewayService } from '../../src/payments/payment-gateway.service';

const MERCHANT = '11111111-1111-4111-8111-111111111111';

describe('Online payment', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let sms: ConsoleSmsDriver;
  let orders: OrdersService;
  let tenantCtx: TenantContext;
  let gateway: ZarinpalApi;
  let A: TenantFixture;
  let B: TenantFixture;
  let shop: ReturnType<typeof shopClient>;
  let std: { id: string };
  let free: { id: string };
  let ownerToken = '';
  let editorToken = '';
  let ownerBToken = '';

  type Client = Awaited<ReturnType<typeof shop.login>>;

  const seller = (token: string) => ({
    get: () =>
      request(app.getHttpServer())
        .get('/api/payment-gateway')
        .set('Authorization', `Bearer ${token}`),
    put: (body: object) =>
      request(app.getHttpServer())
        .put('/api/payment-gateway')
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    del: () =>
      request(app.getHttpServer())
        .delete('/api/payment-gateway')
        .set('Authorization', `Bearer ${token}`),
  });

  const stock = async (variantId: string) =>
    (await prisma.inventory.findFirstOrThrow({ where: { variantId } })).quantity;
  const startPay = (c: Client, number: number, f = A) =>
    shop.call(f, 'post', `/orders/${number}/pay`, c.cookie);
  const callback = (authority: string, status = 'OK', f = A) =>
    shop.call(f, 'post', '/payments/callback').send({ authority, status });
  const payments = (orderId: string) =>
    prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
  const orderRow = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });

  async function buildOrder(opts: { price?: number; quantity?: number; methodId?: string } = {}) {
    const c = await shop.login(A);
    const address = (
      await shop.call(A, 'post', '/addresses', c.cookie).send(addressBody()).expect(201)
    ).body;
    const item = await createProduct(prisma, A, {
      price: opts.price ?? 100_000,
      quantity: opts.quantity ?? 10,
    });
    await shop
      .call(A, 'post', '/cart/items', c.cookie)
      .send({ variantId: item.variant.id, quantity: 2 })
      .expect(200);

    const methodId = opts.methodId ?? std.id;
    const quote = await shop
      .call(A, 'get', '/checkout/quote', c.cookie)
      .query({ shippingMethodId: methodId })
      .expect(200);
    const order = (
      await shop
        .call(A, 'post', '/orders', c.cookie)
        .send({
          addressId: address.id,
          shippingMethodId: methodId,
          expectedTotal: quote.body.total,
        })
        .expect(201)
    ).body as { id: string; number: number; total: number };
    return { c, order, ...item };
  }

  /** سفارش + شروع پرداخت؛ authority را از دیتابیس می‌خواند */
  async function startedPayment(opts: Parameters<typeof buildOrder>[0] = {}) {
    const built = await buildOrder(opts);
    await startPay(built.c, built.order.number).expect(200);
    const [payment] = await payments(built.order.id);
    return { ...built, payment: payment! };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    sms = app.get(ConsoleSmsDriver);
    orders = app.get(OrdersService);
    tenantCtx = app.get(TenantContext);
    gateway = app.get<ZarinpalApi>(ZARINPAL_API);
    shop = shopClient(app, redis, sms);

    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');
    std = await prisma.shippingMethod.create({
      data: { tenantId: A.tenant.id, title: 'پست', fee: 50_000 },
    });
    free = await prisma.shippingMethod.create({
      data: { tenantId: A.tenant.id, title: 'رایگان', fee: 0 },
    });

    const jwt = app.get(JwtService, { strict: false });
    const sign = (u: { id: string; tenantId: string; role: string }) =>
      jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });
    ownerToken = await sign(A.owner);
    editorToken = await sign(A.editor);
    ownerBToken = await sign(B.owner);

    await seller(ownerToken).put({ merchantId: MERCHANT }).expect(200);
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    const ids = [A.tenant.id, B.tenant.id];
    const keys = [
      ...(await Promise.all(ids.map((id) => redis.keys(`otp:*:${id}:*`)))).flat(),
      CACHE_PREFIX + subdomainHost(A),
      CACHE_PREFIX + subdomainHost(B),
    ];
    await redis.del(...keys);
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  // ─────────────────────────── تنظیم درگاه ───────────────────────────
  describe('gateway settings', () => {
    it('stores the merchant id encrypted and never returns it', async () => {
      const row = await prisma.paymentGatewayConfig.findFirstOrThrow({
        where: { tenantId: A.tenant.id },
      });
      expect(row.merchantIdEnc.startsWith('v1.')).toBe(true);
      expect(row.merchantIdEnc).not.toContain(MERCHANT);
      expect(row.merchantHint).toBe('1111');

      const res = await seller(ownerToken).get().expect(200);
      expect(res.body).toEqual({
        provider: 'ZARINPAL',
        configured: true,
        isActive: true,
        merchantHint: '1111',
      });
      expect(JSON.stringify(res.body)).not.toContain(MERCHANT);
    });

    it('only the owner can change it and only owner/admin can read it', async () => {
      await seller(editorToken).get().expect(403);
      await seller(editorToken).put({ merchantId: MERCHANT }).expect(403);
      await seller(editorToken).del().expect(403);
    });

    it('validates the merchant id', async () => {
      for (const merchantId of ['', 'abc', '1'.repeat(36), `${MERCHANT}x`]) {
        await seller(ownerToken).put({ merchantId }).expect(400);
      }
      await seller(ownerToken).put({ merchantId: MERCHANT, extra: 1 }).expect(400);
    });

    it('is isolated per store', async () => {
      const b = await seller(ownerBToken).get().expect(200);
      expect(b.body).toMatchObject({ configured: false, isActive: false, merchantHint: null });
      await seller(ownerBToken).put({ isActive: true }).expect(400); // چیزی برای فعال‌کردن نیست
    });

    it('a ciphertext copied to another store cannot be decrypted there', async () => {
      const aRow = await prisma.paymentGatewayConfig.findFirstOrThrow({
        where: { tenantId: A.tenant.id },
      });
      await prisma.paymentGatewayConfig.create({
        data: {
          tenantId: B.tenant.id,
          provider: 'ZARINPAL',
          merchantIdEnc: aRow.merchantIdEnc,
          merchantHint: '1111',
        },
      });

      const gateways = app.get(PaymentGatewayService);
      const found = await tenantCtx.runAs(B.tenant.id, () =>
        gateways.merchantId({ requireActive: true }),
      );
      expect(found).toBeNull();

      await prisma.paymentGatewayConfig.deleteMany({ where: { tenantId: B.tenant.id } });
    });
  });

  // ─────────────────────────── شروع پرداخت ───────────────────────────
  describe('starting a payment', () => {
    it('returns the gateway url and records an initiated payment', async () => {
      const { c, order } = await buildOrder();
      const res = await startPay(c, order.number).expect(200);

      expect(res.headers['cache-control']).toBe('no-store');
      const [payment] = await payments(order.id);
      expect(payment).toMatchObject({
        status: 'INITIATED',
        amount: order.total,
        provider: 'ZARINPAL',
        refId: null,
      });
      expect(res.body.paymentUrl).toBe(
        `http://${subdomainHost(A)}/dev/fake-gateway?authority=${payment!.authority}&amount=${order.total}`,
      );
    });

    it('holds the stock long enough for the customer to pay', async () => {
      const { c, order } = await buildOrder();
      const before = await orderRow(order.id);
      await startPay(c, order.number).expect(200);

      const after = await orderRow(order.id);
      const minutes = (after.expiresAt!.getTime() - Date.now()) / 60_000;
      expect(after.expiresAt!.getTime()).toBeGreaterThan(before.expiresAt!.getTime());
      expect(minutes).toBeGreaterThan(PAYMENT_HOLD_MINUTES - 1);
      expect(minutes).toBeLessThanOrEqual(PAYMENT_HOLD_MINUTES);

      // job انقضا کاری با سفارش در حال پرداخت ندارد
      expect(await tenantCtx.runAs(A.tenant.id, () => orders.releaseExpired())).toBe(0);
      expect((await orderRow(order.id)).status).toBe('PENDING');
    });

    it('never extends an order beyond its maximum lifetime', async () => {
      const { c, order } = await buildOrder();
      await prisma.order.update({
        where: { id: order.id },
        data: {
          createdAt: new Date(Date.now() - 100 * 60_000),
          expiresAt: new Date(Date.now() + 5 * 60_000),
        },
      });
      await startPay(c, order.number).expect(200);

      const after = await orderRow(order.id);
      const limit = after.createdAt.getTime() + 120 * 60_000;
      expect(after.expiresAt!.getTime()).toBeLessThanOrEqual(limit);
      expect(after.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
    });

    it('needs a login and an order of the same customer', async () => {
      const { c, order } = await buildOrder();
      await shop.call(A, 'post', `/orders/${order.number}/pay`).expect(401);

      const other = await shop.login(A);
      await startPay(other, order.number).expect(404);
      await startPay(c, 999_999).expect(404);
      await startPay(c, 99_999_999_999).expect(404);
    });

    it('refuses orders that are not payable', async () => {
      const done = await buildOrder();
      await shop.call(A, 'post', `/orders/${done.order.number}/cancel`, done.c.cookie).expect(200);
      expect((await startPay(done.c, done.order.number).expect(409)).body.code).toBe('NOT_PAYABLE');

      const expired = await buildOrder();
      await prisma.order.update({
        where: { id: expired.order.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await startPay(expired.c, expired.order.number).expect(409)).body.code).toBe(
        'ORDER_EXPIRED',
      );
    });

    it('refuses amounts below the online payment minimum', async () => {
      const { c, order } = await buildOrder({ price: 100, methodId: free.id });
      expect(order.total).toBe(200);
      expect((await startPay(c, order.number).expect(409)).body.code).toBe('AMOUNT_TOO_LOW');
    });

    it('limits payment attempts per order', async () => {
      const { c, order } = await buildOrder();
      for (let i = 0; i < MAX_PAYMENT_ATTEMPTS; i++) await startPay(c, order.number).expect(200);
      expect((await startPay(c, order.number).expect(409)).body.code).toBe('TOO_MANY_ATTEMPTS');
    });

    it('needs an active gateway', async () => {
      const { c, order } = await buildOrder();
      await seller(ownerToken).put({ isActive: false }).expect(200);
      expect((await startPay(c, order.number).expect(409)).body.code).toBe(
        'GATEWAY_NOT_CONFIGURED',
      );

      await seller(ownerToken).put({ isActive: true }).expect(200);
      await startPay(c, order.number).expect(200);
    });

    it('answers 502 and records nothing when the gateway is down or refuses', async () => {
      const { c, order } = await buildOrder();

      vi.spyOn(gateway, 'request').mockRejectedValueOnce(new GatewayUnavailableError('timeout'));
      await startPay(c, order.number).expect(502);

      vi.spyOn(gateway, 'request').mockResolvedValueOnce({
        kind: 'rejected',
        code: -9,
        message: 'no',
      });
      await startPay(c, order.number).expect(502);

      expect(await payments(order.id)).toHaveLength(0);
      await startPay(c, order.number).expect(200); // دوباره می‌شود
    });
  });

  // ─────────────────────────── بازگشت از درگاه ───────────────────────────
  describe('callback', () => {
    it('marks the order paid after the gateway confirms', async () => {
      const { c, order, payment, variant } = await startedPayment();
      const res = await callback(payment.authority).expect(200);
      expect(res.body).toEqual({ outcome: 'PAID', orderNumber: order.number });

      expect(await orderRow(order.id)).toMatchObject({ status: 'PAID', expiresAt: null });
      expect((await orderRow(order.id)).paidAt).not.toBeNull();

      const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(paid).toMatchObject({ status: 'PAID', gatewayCode: 100, failureReason: null });
      expect(paid.refId).toMatch(/^\d+$/);
      expect(paid.verifiedAt).not.toBeNull();

      // موجودی نگه‌داشته‌شده برمی‌گردد؟ نه: کالا فروخته شده است
      expect(await stock(variant.id)).toBe(8);

      // مشتری رسید را در جزئیات سفارش می‌بیند
      const view = await shop.call(A, 'get', `/orders/${order.number}`, c.cookie).expect(200);
      expect(view.body).toMatchObject({ status: 'PAID', payment: { refId: paid.refId } });
    });

    it('is idempotent: a repeated callback does not call the gateway again', async () => {
      const { payment } = await startedPayment();
      const spy = vi.spyOn(gateway, 'verify');

      await callback(payment.authority).expect(200);
      const again = await callback(payment.authority).expect(200);

      expect(again.body.outcome).toBe('PAID');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('confirms exactly once under concurrent callbacks', async () => {
      const { order, payment } = await startedPayment();
      const spy = vi.spyOn(gateway, 'verify');

      const results = await Promise.all([callback(payment.authority), callback(payment.authority)]);

      expect(results.map((r) => r.body.outcome)).toEqual(['PAID', 'PAID']);
      expect(spy).toHaveBeenCalledTimes(1);
      expect((await orderRow(order.id)).status).toBe('PAID');
    });

    it('treats Status=NOK as a failed attempt and lets the customer retry', async () => {
      const { c, order, payment } = await startedPayment();
      const spy = vi.spyOn(gateway, 'verify');

      const res = await callback(payment.authority, 'NOK').expect(200);
      expect(res.body.outcome).toBe('FAILED');
      expect(spy).not.toHaveBeenCalled();
      expect((await orderRow(order.id)).status).toBe('PENDING');
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
        'FAILED',
      );

      await startPay(c, order.number).expect(200);
      const [, second] = await payments(order.id);
      expect((await callback(second!.authority).expect(200)).body.outcome).toBe('PAID');
    });

    it('keeps the order pending when the gateway does not confirm, and allows a later retry', async () => {
      const { order, payment, variant } = await startedPayment();
      vi.spyOn(gateway, 'verify').mockResolvedValueOnce({
        kind: 'rejected',
        code: -51,
        message: 'failed',
      });

      const first = await callback(payment.authority).expect(200);
      expect(first.body.outcome).toBe('FAILED');
      expect(await orderRow(order.id)).toMatchObject({ status: 'PENDING' });
      expect((await orderRow(order.id)).paidAt).toBeNull();
      expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
        status: 'FAILED',
        gatewayCode: -51,
      });
      expect(await stock(variant.id)).toBe(8);

      // FAILED پایانی نیست: callback بعدی دوباره verify می‌کند
      expect((await callback(payment.authority).expect(200)).body.outcome).toBe('PAID');
    });

    it('never pays the order when the amount does not match', async () => {
      const { order, payment } = await startedPayment();
      await prisma.payment.update({ where: { id: payment.id }, data: { amount: 1 } });

      const res = await callback(payment.authority).expect(200);
      expect(res.body.outcome).toBe('FAILED');
      expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
        status: 'FAILED',
        gatewayCode: -50,
      });
      expect((await orderRow(order.id)).status).toBe('PENDING');
    });

    it('stays undetermined (never FAILED) when the gateway cannot be reached', async () => {
      const { order, payment } = await startedPayment();
      vi.spyOn(gateway, 'verify').mockRejectedValueOnce(new GatewayUnavailableError('timeout'));

      const res = await callback(payment.authority).expect(200);
      expect(res.body.outcome).toBe('PENDING_CHECK');
      expect((await orderRow(order.id)).status).toBe('PENDING');
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
        'INITIATED',
      );

      expect((await callback(payment.authority).expect(200)).body.outcome).toBe('PAID');
    });

    it('is undetermined while the gateway settings are missing, and works again after restoring them', async () => {
      const { order, payment } = await startedPayment();
      await seller(ownerToken).del().expect(204);

      expect((await callback(payment.authority).expect(200)).body.outcome).toBe('PENDING_CHECK');
      expect((await orderRow(order.id)).status).toBe('PENDING');

      await seller(ownerToken).put({ merchantId: MERCHANT }).expect(200);
      expect((await callback(payment.authority).expect(200)).body.outcome).toBe('PAID');
    });

    it('does not verify (and so never takes the money) for a canceled order', async () => {
      const { c, order, payment, variant } = await startedPayment();
      await shop.call(A, 'post', `/orders/${order.number}/cancel`, c.cookie).expect(200);
      const spy = vi.spyOn(gateway, 'verify');

      const res = await callback(payment.authority).expect(200);
      expect(res.body).toEqual({ outcome: 'NOT_PAYABLE', orderNumber: order.number });
      expect(spy).not.toHaveBeenCalled();
      expect((await orderRow(order.id)).status).toBe('CANCELED');
      expect(await stock(variant.id)).toBe(10);
    });

    it('confirms only the first of two payments for the same order', async () => {
      const { c, order } = await buildOrder();
      await startPay(c, order.number).expect(200);
      await startPay(c, order.number).expect(200);
      const [one, two] = await payments(order.id);
      const spy = vi.spyOn(gateway, 'verify');

      expect((await callback(one!.authority).expect(200)).body.outcome).toBe('PAID');
      expect((await callback(two!.authority).expect(200)).body.outcome).toBe('NOT_PAYABLE');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('a paid order cannot be canceled by the customer afterwards', async () => {
      const { c, order, payment } = await startedPayment();
      await callback(payment.authority).expect(200);
      await shop.call(A, 'post', `/orders/${order.number}/cancel`, c.cookie).expect(409);
    });

    it('gives the stock back if the seller cancels a paid order', async () => {
      const { order, payment, variant } = await startedPayment();
      await callback(payment.authority).expect(200);

      await tenantCtx.runAs(A.tenant.id, () =>
        orders.transition(order.id, 'CANCELED', { reason: 'SELLER' }),
      );
      expect(await stock(variant.id)).toBe(10);
    });

    it('rejects unknown authorities, other stores and bad payloads', async () => {
      const { payment } = await startedPayment();

      await callback('A'.padEnd(36, '0')).expect(404);
      await callback(payment.authority, 'OK', B).expect(404); // فروشگاه دیگر
      await shop
        .call(A, 'post', '/payments/callback')
        .send({ authority: 'x', status: 'OK' })
        .expect(400);
      await shop
        .call(A, 'post', '/payments/callback')
        .send({ authority: payment.authority })
        .expect(400);
      await shop
        .call(A, 'post', '/payments/callback')
        .send({ authority: `${payment.authority}!`, status: 'OK' })
        .expect(400);
      await shop
        .call(A, 'post', '/payments/callback')
        .send({ authority: payment.authority, status: 'OK', total: 1 })
        .expect(400);
    });

    it('answers 404 without a store host', async () => {
      await request(app.getHttpServer())
        .post('/api/storefront/payments/callback')
        .send({ authority: 'A'.padEnd(36, '0'), status: 'OK' })
        .expect(404);
    });
  });
});
