import { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { ConsoleSmsDriver } from '../../src/sms/drivers/console.driver';
import { cookieHeader, cookieValue } from './cookies';
import { subdomainHost, type TenantFixture } from './fixtures';

const base = Math.floor(Math.random() * 4_000_000);
let seq = 0;
export const uniquePhone = () => `0915${String(base + ++seq).padStart(7, '0')}`;

export interface ProductOpts {
  title?: string;
  status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  price?: number;
  quantity?: number;
  allowBackorder?: boolean;
}

export async function createProduct(
  prisma: PrismaService,
  f: TenantFixture,
  opts: ProductOpts = {},
) {
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

/** درخواست به API ویترین و ورود با OTP (کد از صندوق پیامک خوانده می‌شود) */
export function shopClient(app: INestApplication, redis: Redis, sms: ConsoleSmsDriver) {
  const call = (
    f: TenantFixture,
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    cookie?: string,
  ) => {
    const req = request(app.getHttpServer())
      [method](`/api/storefront${path}`)
      .set('Host', subdomainHost(f));
    return cookie ? req.set('Cookie', cookie) : req;
  };

  async function login(f: TenantFixture, phone = uniquePhone()) {
    // شمارنده‌ی IP را صفر می‌کنیم: تست‌ها همه از یک IP می‌آیند و ده‌ها بار وارد می‌شوند
    const ipKeys = await redis.keys(`otp:ip:${f.tenant.id}:*`);
    if (ipKeys.length) await redis.del(...ipKeys);
    await redis.del(`otp:cd:${f.tenant.id}:${phone}`);

    await call(f, 'post', '/auth/otp').send({ phone }).expect(200);

    // پیامک را با شماره‌ی خودش پیدا می‌کنیم؛ صندوق را پاک نمی‌کنیم تا ورودهای هم‌زمان قاطی نشوند
    const message = [...sms.outbox].reverse().find((m) => m.kind === 'otp' && m.to === phone);
    const code = message!.args[0]!;

    const res = await call(f, 'post', '/auth/verify').send({ phone, code }).expect(200);
    return {
      phone,
      customerId: res.body.customer.id as string,
      cookie: cookieHeader({ sf_session: cookieValue(res, 'sf_session') }),
    };
  }

  return { call, login };
}

export const addressBody = (over: Record<string, unknown> = {}) => ({
  recipientName: 'علی رضایی',
  recipientPhone: '09121234567',
  province: 'تهران',
  city: 'تهران',
  address: 'خیابان ولیعصر، کوچه‌ی دوم، پلاک ۱۲',
  postalCode: '1234567890',
  ...over,
});
