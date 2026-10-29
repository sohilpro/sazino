import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConsoleMailDriver } from '../../src/mail/drivers/console.driver';
import { NotificationsHandler } from '../../src/notifications/notifications.handler';
import { NOTIFICATIONS_QUEUE } from '../../src/notifications/notifications.constants';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { ConsoleSmsDriver } from '../../src/sms/drivers/console.driver';
import { SmsService } from '../../src/sms/sms.service';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, subdomainHost, type TenantFixture } from '../helpers/fixtures';
import { markPaidInDb, placeOrder, type OrderKit } from '../helpers/orders';
import { shopClient } from '../helpers/shop';

describe('Notifications', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let smsDriver: ConsoleSmsDriver;
  let smsService: SmsService;
  let mail: ConsoleMailDriver;
  let handler: NotificationsHandler;
  let notifications: NotificationsService;
  let queue: Queue;
  let A: TenantFixture;
  let kit: OrderKit;

  const data = (orderId: string) => ({ tenantId: A.tenant.id, orderId });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    smsDriver = app.get(ConsoleSmsDriver);
    smsService = app.get(SmsService);
    mail = app.get(ConsoleMailDriver);
    handler = app.get(NotificationsHandler);
    notifications = app.get(NotificationsService);
    queue = app.get<Queue>(getQueueToken(NOTIFICATIONS_QUEUE));

    A = await createFixture(prisma, 'a');
    const method = await prisma.shippingMethod.create({
      data: { tenantId: A.tenant.id, title: 'پست', fee: 50_000 },
    });
    kit = { prisma, shop: shopClient(app, redis, smsDriver), tenant: A, methodId: method.id };
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    const keys = [
      ...(await redis.keys(`otp:*:${A.tenant.id}:*`)),
      CACHE_PREFIX + subdomainHost(A),
    ];
    await redis.del(...keys);
    await cleanupFixtures(prisma, [A]);
    await app.close();
  });

  describe('enqueueing', () => {
    it('adds one job per channel and ignores duplicates', async () => {
      const { order } = await placeOrder(kit);
      await notifications.orderPaid(A.tenant.id, order.id);
      await notifications.orderPaid(A.tenant.id, order.id);

      const waiting = await queue.getJobs(['waiting']);
      const mine = waiting.filter((j) => j.data.orderId === order.id);
      expect(mine.map((j) => j.name).sort()).toEqual(['paid-customer-sms', 'paid-seller-email']);
      expect(mine[0]!.data).toEqual({ tenantId: A.tenant.id, orderId: order.id });
    });

    it('adds a shipped job', async () => {
      const { order } = await placeOrder(kit);
      await notifications.orderShipped(A.tenant.id, order.id);
      const job = await queue.getJob(`shipped-customer-sms-${order.id}`);
      expect(job?.data).toEqual(data(order.id));
    });

    it('never throws when the queue is unavailable', async () => {
      vi.spyOn(queue, 'add').mockRejectedValue(new Error('redis down'));
      await expect(notifications.orderPaid(A.tenant.id, randomUUID())).resolves.toBeUndefined();
    });
  });

  describe('customer SMS', () => {
    it('sends the paid pattern with the order number', async () => {
      const { c, order } = await placeOrder(kit);
      await markPaidInDb(prisma, order.id);
      smsDriver.outbox.length = 0;

      await handler.handle('paid-customer-sms', data(order.id));

      expect(smsDriver.outbox).toEqual([{ kind: 'order', to: c.phone, args: [String(order.number)] }]);
    });

    it('does not announce an order that is not paid', async () => {
      const { order } = await placeOrder(kit);
      smsDriver.outbox.length = 0;
      await handler.handle('paid-customer-sms', data(order.id));
      expect(smsDriver.outbox).toEqual([]);
    });

    it('skips quietly when the pattern is not configured', async () => {
      const { order } = await placeOrder(kit);
      await markPaidInDb(prisma, order.id);
      smsDriver.outbox.length = 0;
      vi.spyOn(smsService, 'supports').mockReturnValue(false);

      await handler.handle('paid-customer-sms', data(order.id));
      expect(smsDriver.outbox).toEqual([]);
    });

    it('sends the shipped pattern with the tracking code (or a dash)', async () => {
      const withCode = await placeOrder(kit);
      await prisma.order.update({
        where: { id: withCode.order.id },
        data: { status: 'SHIPPED', shippedAt: new Date(), trackingCode: 'RX123' },
      });
      const withoutCode = await placeOrder(kit);
      await prisma.order.update({
        where: { id: withoutCode.order.id },
        data: { status: 'SHIPPED', shippedAt: new Date() },
      });
      smsDriver.outbox.length = 0;

      await handler.handle('shipped-customer-sms', data(withCode.order.id));
      await handler.handle('shipped-customer-sms', data(withoutCode.order.id));

      expect(smsDriver.outbox.map((m) => m.args)).toEqual([
        [String(withCode.order.number), 'RX123'],
        [String(withoutCode.order.number), '-'],
      ]);
      expect(smsDriver.outbox.every((m) => m.kind === 'shipped')).toBe(true);
    });

    it('lets send errors through so the queue retries', async () => {
      const { order } = await placeOrder(kit);
      await markPaidInDb(prisma, order.id);
      vi.spyOn(smsDriver, 'send').mockRejectedValueOnce(new Error('provider down'));

      await expect(handler.handle('paid-customer-sms', data(order.id))).rejects.toThrow('provider down');
    });
  });

  describe('seller email', () => {
    it('goes to active owners and admins only, as one message', async () => {
      const suffix = randomUUID().slice(0, 8);
      const admin = await prisma.user.create({
        data: {
          tenantId: A.tenant.id,
          email: `admin-${suffix}@test.dev`,
          name: 'Admin',
          passwordHash: 'x',
          role: 'ADMIN',
        },
      });
      await prisma.user.create({
        data: {
          tenantId: A.tenant.id,
          email: `gone-${suffix}@test.dev`,
          name: 'Inactive',
          passwordHash: 'x',
          role: 'ADMIN',
          isActive: false,
        },
      });

      const { order } = await placeOrder(kit);
      await markPaidInDb(prisma, order.id);
      mail.outbox.length = 0;

      await handler.handle('paid-seller-email', data(order.id));

      expect(mail.outbox).toHaveLength(1);
      expect([...mail.outbox[0]!.to].sort()).toEqual([A.owner.email, admin.email].sort());
      expect(mail.outbox[0]!.to).not.toContain(A.editor.email);
      expect(mail.outbox[0]!.text).toContain(`/orders/${order.number}`);
    });

    it('escapes product titles in the html body', async () => {
      const { order } = await placeOrder(kit, { title: '<img src=x onerror=alert(1)>' });
      await markPaidInDb(prisma, order.id);
      mail.outbox.length = 0;

      await handler.handle('paid-seller-email', data(order.id));

      const html = mail.outbox[0]!.html!;
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img');
    });

    it('is not sent for unpaid orders', async () => {
      const { order } = await placeOrder(kit);
      mail.outbox.length = 0;
      await handler.handle('paid-seller-email', data(order.id));
      expect(mail.outbox).toEqual([]);
    });
  });

  describe('robustness', () => {
    it('ignores unknown orders, unknown stores and unknown jobs', async () => {
      await expect(handler.handle('paid-customer-sms', data(randomUUID()))).resolves.toBeUndefined();
      await expect(
        handler.handle('paid-seller-email', { tenantId: randomUUID(), orderId: randomUUID() }),
      ).resolves.toBeUndefined();
      await expect(handler.handle('no-such-job', data(randomUUID()))).resolves.toBeUndefined();
    });

    it('never reads an order of another store', async () => {
      const B = await createFixture(prisma, 'b');
      try {
        const method = await prisma.shippingMethod.create({
          data: { tenantId: B.tenant.id, title: 'پست', fee: 1000 },
        });
        const { order } = await placeOrder({ ...kit, tenant: B, methodId: method.id });
        await markPaidInDb(prisma, order.id);
        smsDriver.outbox.length = 0;

        // job فروشگاه A با شناسه‌ی سفارش فروشگاه B
        await handler.handle('paid-customer-sms', data(order.id));
        expect(smsDriver.outbox).toEqual([]);
      } finally {
        await redis.del(...(await redis.keys(`otp:*:${B.tenant.id}:*`)), CACHE_PREFIX + subdomainHost(B));
        await cleanupFixtures(prisma, [B]);
      }
    });
  });
});