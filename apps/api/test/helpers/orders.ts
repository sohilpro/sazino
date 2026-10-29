import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { TenantFixture } from './fixtures';
import { addressBody, createProduct, type shopClient } from './shop';

export interface OrderKit {
  prisma: PrismaService;
  shop: ReturnType<typeof shopClient>;
  tenant: TenantFixture;
  methodId: string;
}

/** مشتری تازه + آدرس + کالا + سبد + ثبت سفارش (وضعیت PENDING) */
export async function placeOrder(
  kit: OrderKit,
  opts: {
    price?: number;
    quantity?: number;
    qty?: number;
    title?: string;
    address?: Record<string, unknown>;
  } = {},
) {
  const { prisma, shop, tenant: f } = kit;
  const c = await shop.login(f);
  const address = (
    await shop.call(f, 'post', '/addresses', c.cookie).send(addressBody(opts.address)).expect(201)
  ).body;
  const item = await createProduct(prisma, f, {
    price: opts.price ?? 100_000,
    quantity: opts.quantity ?? 10,
    title: opts.title,
  });
  await shop
    .call(f, 'post', '/cart/items', c.cookie)
    .send({ variantId: item.variant.id, quantity: opts.qty ?? 2 })
    .expect(200);

  const quote = await shop
    .call(f, 'get', '/checkout/quote', c.cookie)
    .query({ shippingMethodId: kit.methodId })
    .expect(200);
  const order = (
    await shop
      .call(f, 'post', '/orders', c.cookie)
      .send({ addressId: address.id, shippingMethodId: kit.methodId, expectedTotal: quote.body.total })
      .expect(201)
  ).body as { id: string; number: number; total: number };

  return { c, order, ...item };
}

export const markPaidInDb = (prisma: PrismaService, orderId: string) =>
  prisma.order.update({
    where: { id: orderId },
    data: { status: 'PAID', paidAt: new Date(), expiresAt: null },
  });

export const newKey = () => randomUUID();