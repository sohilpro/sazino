import { INestApplication } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ensureTenantRole } from '../../scripts/tenant-role';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, type TenantFixture } from '../helpers/fixtures';
import { createProduct } from '../helpers/shop';

const rlsOn = process.env.RLS_TESTS !== 'off';

/** این تست‌ها مستقیم با نقش بدون BYPASSRLS به Postgres وصل می‌شوند، بدون هیچ فیلتر برنامه‌ای */
describe.skipIf(!rlsOn)('Row level security (database level)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let pool: Pool;
  let A: TenantFixture;
  let B: TenantFixture;
  let productA = '';
  let productB = '';

  const SYSTEM_TABLES = [
    'refresh_tokens',
    'plans',
    'platform_admins',
    'admin_sessions',
    'admin_audit_logs',
  ];

  /** یک تراکنش با app.tenant_id مشخص (یا بدون آن) اجرا می‌کند و همیشه rollback می‌زند */
  async function as<T>(tenantId: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (tenantId !== null)
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      return await fn(client);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  }
  const count = async (c: PoolClient, sql: string, params: unknown[] = []) =>
    Number(
      (await c.query<{ n: string }>(`SELECT count(*) AS n FROM (${sql}) t`, params)).rows[0]!.n,
    );

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    pool = new Pool({ connectionString: process.env.TENANT_DATABASE_URL, max: 3 });
    A = await createFixture(prisma, 'rlsa');
    B = await createFixture(prisma, 'rlsb');
    productA = (await createProduct(prisma, A, { status: 'ACTIVE' })).product.id;
    productB = (await createProduct(prisma, B, { status: 'ACTIVE' })).product.id;
  });

  afterAll(async () => {
    await pool.end();
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  it('connects as a role that can neither be superuser nor bypass row level security', async () => {
    const tenantRole = decodeURIComponent(new URL(process.env.TENANT_DATABASE_URL!).username);
    await as(null, async (c) => {
      const { rows } = await c.query<{
        current_user: string;
        rolsuper: boolean;
        rolbypassrls: boolean;
      }>(
        'SELECT current_user, r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user',
      );
      expect(rows[0]).toEqual({ current_user: tenantRole, rolsuper: false, rolbypassrls: false });
    });
  });

  it('sees no row of any tenant table when no tenant is set (fail-closed)', async () => {
    await as(null, async (c) => {
      for (const table of [
        'users',
        'products',
        'variants',
        'inventory',
        'orders',
        'customers',
        'pages',
        'carts',
        'domains',
      ]) {
        expect(await count(c, `SELECT 1 FROM ${table}`), table).toBe(0);
      }
      expect(await count(c, 'SELECT 1 FROM tenants')).toBe(0);
    });
  });

  it('treats an empty tenant setting as "no tenant" instead of failing', async () => {
    await as('', async (c) => {
      expect(await count(c, 'SELECT 1 FROM products')).toBe(0);
    });
  });

  it("shows only the current tenant's rows", async () => {
    await as(A.tenant.id, async (c) => {
      expect(await count(c, 'SELECT 1 FROM products WHERE id = $1', [productA])).toBe(1);
      expect(await count(c, 'SELECT 1 FROM products WHERE id = $1', [productB])).toBe(0);
      expect(await count(c, 'SELECT 1 FROM products WHERE tenant_id <> $1', [A.tenant.id])).toBe(0);
      expect(await count(c, 'SELECT 1 FROM users WHERE tenant_id <> $1', [A.tenant.id])).toBe(0);
    });
    await as(B.tenant.id, async (c) => {
      expect(await count(c, 'SELECT 1 FROM products WHERE id = $1', [productB])).toBe(1);
      expect(await count(c, 'SELECT 1 FROM products WHERE id = $1', [productA])).toBe(0);
    });
  });

  it('cannot insert, move or change rows of another tenant', async () => {
    await as(A.tenant.id, async (c) => {
      // ردیف خودی را به tenant دیگر منتقل کردن ممنوع است (WITH CHECK)
      await c.query('SAVEPOINT s1');
      await expect(
        c.query('UPDATE products SET tenant_id = $1 WHERE id = $2', [B.tenant.id, productA]),
      ).rejects.toMatchObject({ code: '42501' });
      await c.query('ROLLBACK TO SAVEPOINT s1');

      // ردیف tenant دیگر دیده نمی‌شود؛ پس تغییر و حذف آن هیچ ردیفی را درگیر نمی‌کند
      const upd = await c.query("UPDATE products SET title = 'hacked' WHERE id = $1", [productB]);
      expect(upd.rowCount).toBe(0);
      const del = await c.query('DELETE FROM products WHERE id = $1', [productB]);
      expect(del.rowCount).toBe(0);

      // درج با tenantId دیگر ممنوع است
      await c.query('SAVEPOINT s2');
      await expect(
        c.query(
          `INSERT INTO categories (id, tenant_id, name, slug, updated_at) VALUES (gen_random_uuid(), $1, 'x', 'x-rls', now())`,
          [B.tenant.id],
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await c.query('ROLLBACK TO SAVEPOINT s2');
    });
    // و واقعاً دست‌نخورده مانده است
    const still = await prisma.product.findUniqueOrThrow({ where: { id: productB } });
    expect(still.tenantId).toBe(B.tenant.id);
    expect(still.title).not.toBe('hacked');
  });

  it('can read its own tenant row but never change tenants', async () => {
    await as(A.tenant.id, async (c) => {
      expect(await count(c, 'SELECT 1 FROM tenants')).toBe(1);
      expect(await count(c, 'SELECT 1 FROM tenants WHERE id = $1', [B.tenant.id])).toBe(0);
      await c.query('SAVEPOINT s');
      await expect(
        c.query("UPDATE tenants SET name = 'x' WHERE id = $1", [A.tenant.id]),
      ).rejects.toMatchObject({ code: '42501' });
      await c.query('ROLLBACK TO SAVEPOINT s');
      await expect(
        c.query('DELETE FROM tenants WHERE id = $1', [A.tenant.id]),
      ).rejects.toMatchObject({ code: '42501' });
    });
  });

  it.each(SYSTEM_TABLES)('has no access at all to the system table %s', async (table) => {
    await as(A.tenant.id, async (c) => {
      await expect(c.query(`SELECT 1 FROM ${table} LIMIT 1`)).rejects.toMatchObject({
        code: '42501',
      });
    });
  });

  it('does not leak the tenant setting past the transaction (pooled connections stay safe)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [A.tenant.id]);
      expect(await count(client, 'SELECT 1 FROM products WHERE id = $1', [productA])).toBe(1);
      await client.query('COMMIT');
      // همان اتصال، تراکنش بعدی: هیچ tenantی تنظیم نیست
      expect(await count(client, 'SELECT 1 FROM products WHERE id = $1', [productA])).toBe(0);
    } finally {
      client.release();
    }
  });

  describe('ensureTenantRole', () => {
    // همان URL و رمزی که برنامه با آن وصل است؛ رمز نقش هیچ‌وقت عوض نمی‌شود
    const effectiveUrl = () => process.env.TENANT_DATABASE_URL!;

    it('is idempotent and never produces a privileged role', async () => {
      const role = decodeURIComponent(new URL(effectiveUrl()).username);
      await expect(ensureTenantRole(process.env.DATABASE_URL!, effectiveUrl())).resolves.toBe(role);
      await expect(ensureTenantRole(process.env.DATABASE_URL!, effectiveUrl())).resolves.toBe(role);
    });

    it('refuses the system role and an empty password', async () => {
      const system = new URL(process.env.DATABASE_URL!);
      await expect(ensureTenantRole(system.toString(), system.toString())).rejects.toThrow(
        /different role/,
      );

      const noPassword = new URL(process.env.DATABASE_URL!);
      noPassword.username = 'someone';
      noPassword.password = '';
      await expect(
        ensureTenantRole(process.env.DATABASE_URL!, noPassword.toString()),
      ).rejects.toThrow(/password/);
    });

    it('keeps the application connection working afterwards', async () => {
      const probe = new Pool({ connectionString: effectiveUrl(), max: 1 });
      try {
        await expect(probe.query('SELECT 1')).resolves.toBeTruthy();
      } finally {
        await probe.end();
      }
    });
  });
});
