import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantPrismaService } from '../../src/prisma/tenant-prisma.service';
import { TENANT_DB, type TenantDb } from '../../src/tenants/tenant-db';
import { TenantContext } from '../../src/tenants/tenant-context';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, type TenantFixture } from '../helpers/fixtures';
import { createProduct } from '../helpers/shop';

const rlsOn = process.env.RLS_TESTS !== 'off';

describe.skipIf(!rlsOn)('Tenant client with row level security', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let db: TenantDb;
  let ctx: TenantContext;
  let A: TenantFixture;
  let B: TenantFixture;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    db = app.get<TenantDb>(TENANT_DB);
    ctx = app.get(TenantContext);
    A = await createFixture(prisma, 'tca');
    B = await createFixture(prisma, 'tcb');
    for (let i = 0; i < 2; i++) await createProduct(prisma, A, { status: 'ACTIVE' });
    for (let i = 0; i < 3; i++) await createProduct(prisma, B, { status: 'ACTIVE' });
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  it('is connected through the restricted role', () => {
    expect(app.get(TenantPrismaService).rls).toBe(true);
  });

  it("returns only the current tenant's rows for plain operations", async () => {
    const a = await ctx.runAs(A.tenant.id, () => db.product.findMany());
    const b = await ctx.runAs(B.tenant.id, () => db.product.findMany());
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(3);
    expect(a.every((p) => p.tenantId === A.tenant.id)).toBe(true);
  });

  it('keeps tenants apart inside interactive transactions, even for SQL that ignores the application filter', async () => {
    const tenants = await ctx.runAs(A.tenant.id, () =>
      db.$transaction(async (tx) => tx.$queryRaw<{ tenant_id: string }[]>`SELECT DISTINCT tenant_id FROM products`),
    );
    expect(tenants.map((r) => r.tenant_id)).toEqual([A.tenant.id]);
  });

  it('shows raw SQL outside a transaction nothing at all (fail-closed)', async () => {
    const rows = await ctx.runAs(A.tenant.id, () => db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM products`);
    expect(rows[0]?.n).toBe(0);
  });

  it('writes inside a transaction and rolls back completely on error', async () => {
    await expect(
      ctx.runAs(A.tenant.id, () =>
        db.$transaction(async (tx) => {
          await tx.category.create({ data: { tenantId: A.tenant.id, name: 'tx', slug: 'rls-tx-rollback' } });
          expect(await tx.category.count({ where: { slug: 'rls-tx-rollback' } })).toBe(1);
          throw new Error('boom');
        }),
      ),
    ).rejects.toThrow('boom');
    expect(await prisma.category.count({ where: { slug: 'rls-tx-rollback' } })).toBe(0);
  });

  it('commits transactional writes under the right tenant', async () => {
    await ctx.runAs(B.tenant.id, () =>
      db.$transaction(async (tx) => {
        await tx.category.create({ data: { tenantId: B.tenant.id, name: 'ok', slug: 'rls-tx-commit' } });
      }),
    );
    const row = await prisma.category.findFirstOrThrow({ where: { slug: 'rls-tx-commit' } });
    expect(row.tenantId).toBe(B.tenant.id);
    // و tenant دیگر آن را نمی‌بیند
    expect(await ctx.runAs(A.tenant.id, () => db.category.count({ where: { slug: 'rls-tx-commit' } }))).toBe(0);
  });

  it('refuses to run without a tenant context', async () => {
    await expect(Promise.resolve().then(() => db.product.findMany())).rejects.toThrow();
    await expect(Promise.resolve().then(() => db.$transaction(async () => 1))).rejects.toThrow();
  });

  it('never mixes tenants when many operations share the connection pool', async () => {
    const jobs = Array.from({ length: 60 }, (_, i) => {
      const f = i % 2 === 0 ? A : B;
      return ctx.runAs(f.tenant.id, async () => {
        const rows =
          i % 3 === 0
            ? await db.$transaction(async (tx) => tx.product.findMany({ select: { tenantId: true } }))
            : await db.product.findMany({ select: { tenantId: true } });
        return { expected: f.tenant.id, seen: [...new Set(rows.map((r) => r.tenantId))] };
      });
    });
    for (const result of await Promise.all(jobs)) {
      expect(result.seen).toEqual([result.expected]);
    }
  });
});