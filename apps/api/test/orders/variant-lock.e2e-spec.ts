import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lockVariantsForShare } from '../../src/orders/variant-lock';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, type TenantFixture } from '../helpers/fixtures';
import { createProduct } from '../helpers/shop';

describe('Variant price lock', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let pool: Pool;
  let F: TenantFixture;
  let variantId = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    F = await createFixture(prisma, 'vl');
    await createProduct(prisma, F, { status: 'ACTIVE' });
    variantId = (await prisma.variant.findFirstOrThrow({ where: { tenantId: F.tenant.id } })).id;
  });

  afterAll(async () => {
    await pool.end();
    await cleanupFixtures(prisma, [F]);
    await app.close();
  });

  it('blocks a concurrent price change until the order transaction ends, but not reads', async () => {
    let release!: () => void;
    let locked!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const hasLock = new Promise<void>((resolve) => (locked = resolve));

    const orderTx = prisma.$transaction(
      async (tx) => {
        await lockVariantsForShare(tx, F.tenant.id, [variantId, variantId]);
        locked();
        await gate;
      },
      { timeout: 20_000 },
    );
    await hasLock;

    const seller = await pool.connect();
    try {
      await seller.query("SET lock_timeout = '300ms'");
      await expect(
        seller.query('UPDATE variants SET price = price + 1 WHERE id = $1', [variantId]),
      ).rejects.toMatchObject({ code: '55P03' });
      // خواندن آزاد است
      await expect(seller.query('SELECT price FROM variants WHERE id = $1', [variantId])).resolves.toBeTruthy();
    } finally {
      release();
      await orderTx;
    }

    // بعد از پایان تراکنش سفارش، تغییر قیمت ممکن است
    await expect(
      seller.query('UPDATE variants SET price = price + 1 WHERE id = $1', [variantId]),
    ).resolves.toBeTruthy();
    seller.release();
  });

  it('does nothing for an empty list and ignores another store\'s variants', async () => {
    await expect(prisma.$transaction((tx) => lockVariantsForShare(tx, F.tenant.id, []))).resolves.toBeUndefined();
    await expect(
      prisma.$transaction((tx) => lockVariantsForShare(tx, '00000000-0000-7000-8000-000000000000', [variantId])),
    ).resolves.toBeUndefined();
  });
});