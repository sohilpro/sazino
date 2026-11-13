import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { ConsoleSmsDriver } from '../../src/sms/drivers/console.driver';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, type TenantFixture } from '../helpers/fixtures';
import { addressBody, createProduct, shopClient } from '../helpers/shop';

/**
 * ثبت هم‌زمان سفارش‌ها در برابر تغییر قیمت فروشنده (قفل FOR SHARE روی تنوع‌ها).
 * ثابت می‌کند: فروش بیش از موجودی ممکن نیست، قفل‌ها deadlock نمی‌سازند، و هیچ پاسخ ۵۰۰ نمی‌آید.
 */
describe('Order creation under concurrency', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let shop: ReturnType<typeof shopClient>;
  let F: TenantFixture;
  let methodId = '';
  let ownerToken = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    shop = shopClient(app, app.get<Redis>(REDIS_CLIENT), app.get(ConsoleSmsDriver));
    F = await createFixture(prisma, 'cc');
    methodId = (
      await prisma.shippingMethod.create({ data: { tenantId: F.tenant.id, title: 'پست', fee: 10_000, position: 1 } })
    ).id;
    const jwt = app.get(JwtService, { strict: false });
    ownerToken = await jwt.signAsync({ sub: F.owner.id, tenantId: F.owner.tenantId, role: F.owner.role });
  }, 60_000);

  afterAll(async () => {
    await cleanupFixtures(prisma, [F]);
    await app.close();
  });

  it('never oversells while the seller keeps changing the price', async () => {
    const STOCK = 4;
    const BUYERS = 8;
    const item = await createProduct(prisma, F, { price: 100_000, quantity: STOCK });

    // هر مشتری یک عدد در سبد دارد
    const buyers = [];
    for (let i = 0; i < BUYERS; i++) {
      const c = await shop.login(F);
      const address = (await shop.call(F, 'post', '/addresses', c.cookie).send(addressBody()).expect(201)).body;
      await shop.call(F, 'post', '/cart/items', c.cookie).send({ variantId: item.variant.id, quantity: 1 }).expect(200);
      const quote = await shop
        .call(F, 'get', '/checkout/quote', c.cookie)
        .query({ shippingMethodId: methodId })
        .expect(200);
      buyers.push({ c, address, total: quote.body.total as number });
    }

    // سفارش‌ها و تغییرهای قیمت هم‌زمان؛ قیمت به همان مقدار می‌ماند تا فقط قفل‌ها سنجیده شوند
    const priceChanges = Array.from({ length: 10 }, () =>
      request(app.getHttpServer())
        .patch(`/api/products/${item.product.id}/variants/${item.variant.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ price: 100_000 }),
    );
    const placements = buyers.map(({ c, address, total }) =>
      shop
        .call(F, 'post', '/orders', c.cookie)
        .send({ addressId: address.id, shippingMethodId: methodId, expectedTotal: total }),
    );

    const results = await Promise.all([...placements, ...priceChanges]);
    const orders = results.slice(0, BUYERS);
    const changes = results.slice(BUYERS);

    expect(results.filter((r) => r.status >= 500).map((r) => r.status)).toEqual([]);
    expect(changes.every((r) => r.status === 200)).toBe(true);

    const created = orders.filter((r) => r.status === 201).length;
    const refused = orders.filter((r) => r.status === 409);
    expect(created).toBe(STOCK);
    expect(refused).toHaveLength(BUYERS - STOCK);
    expect(refused.every((r) => r.body.code === 'OUT_OF_STOCK')).toBe(true);

    const left = await prisma.inventory.findFirstOrThrow({ where: { variantId: item.variant.id } });
    expect(left.quantity).toBe(0);
  }, 90_000);

  it('rejects an order whose price was changed by the seller in between', async () => {
    const item = await createProduct(prisma, F, { price: 100_000, quantity: 5 });
    const c = await shop.login(F);
    const address = (await shop.call(F, 'post', '/addresses', c.cookie).send(addressBody()).expect(201)).body;
    await shop.call(F, 'post', '/cart/items', c.cookie).send({ variantId: item.variant.id, quantity: 1 }).expect(200);
    const quote = await shop
      .call(F, 'get', '/checkout/quote', c.cookie)
      .query({ shippingMethodId: methodId })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/products/${item.product.id}/variants/${item.variant.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ price: 120_000 })
      .expect(200);

    const res = await shop
      .call(F, 'post', '/orders', c.cookie)
      .send({ addressId: address.id, shippingMethodId: methodId, expectedTotal: quote.body.total });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PRICE_CHANGED');
    // و موجودی دست‌نخورده است
    const left = await prisma.inventory.findFirstOrThrow({ where: { variantId: item.variant.id } });
    expect(left.quantity).toBe(5);
  }, 60_000);
});