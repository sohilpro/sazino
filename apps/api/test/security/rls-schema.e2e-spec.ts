import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** جدول‌های سیستمی: نقش tenant نباید هیچ دسترسی‌ای به آن‌ها داشته باشد */
const SYSTEM_TABLES = ['refresh_tokens', 'plans', 'platform_admins', 'admin_sessions', 'admin_audit_logs'];
const ROOT_TABLES = ['tenants'];
const GROUP_ROLE = 'myapp_tenant';

/**
 * اگر جدول تازه‌ای با tenant_id ساخته شود و migrationش RLS و policy و GRANT نداشته باشد،
 * این تست قرمز می‌شود. جدول بدون tenant_id هم باید صریحاً در فهرست سیستمی/ریشه بیاید.
 */
describe('Row level security coverage (schema)', () => {
  let pool: Pool;
  let tables: string[] = [];
  let tenantTables: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    const all = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
       ORDER BY 1`,
    );
    tables = all.rows.map((r) => r.table_name);
    const withTenant = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'tenant_id' ORDER BY 1`,
    );
    tenantTables = withTenant.rows.map((r) => r.table_name);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('classifies every table as tenant-scoped, root or system', () => {
    const unclassified = tables.filter(
      (t) => !tenantTables.includes(t) && !SYSTEM_TABLES.includes(t) && !ROOT_TABLES.includes(t),
    );
    expect(unclassified).toEqual([]);
    expect(tenantTables.length).toBeGreaterThanOrEqual(20);
  });

  it('enables row level security and a policy on every tenant table and on tenants', async () => {
    const res = await pool.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT c.relname, c.relrowsecurity FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1)`,
      [[...tenantTables, ...ROOT_TABLES]],
    );
    expect(res.rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);

    const policies = await pool.query<{ tablename: string }>(
      `SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public'`,
    );
    const covered = policies.rows.map((r) => r.tablename);
    expect([...tenantTables, ...ROOT_TABLES].filter((t) => !covered.includes(t))).toEqual([]);
  });

  it('every tenant policy checks tenant_id for reads and writes', async () => {
    const res = await pool.query<{ tablename: string; qual: string | null; with_check: string | null }>(
      `SELECT tablename, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [tenantTables],
    );
    for (const row of res.rows) {
      expect(row.qual, row.tablename).toContain('tenant_id');
      expect(row.qual, row.tablename).toContain("current_setting('app.tenant_id'");
      expect(row.with_check, row.tablename).toContain('tenant_id');
    }
  });

  it('grants the tenant role CRUD on tenant tables, read-only on tenants, and nothing on system tables', async () => {
    const priv = (table: string, p: string) =>
      pool
        .query<{ ok: boolean }>('SELECT has_table_privilege($1, $2, $3) AS ok', [GROUP_ROLE, `public.${table}`, p])
        .then((r) => r.rows[0]!.ok);

    for (const t of tenantTables) {
      for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) expect(await priv(t, p), `${t} ${p}`).toBe(true);
      expect(await priv(t, 'TRUNCATE'), `${t} TRUNCATE`).toBe(false);
    }
    expect(await priv('tenants', 'SELECT')).toBe(true);
    for (const p of ['INSERT', 'UPDATE', 'DELETE']) expect(await priv('tenants', p), `tenants ${p}`).toBe(false);
    for (const t of SYSTEM_TABLES) {
      for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) expect(await priv(t, p), `${t} ${p}`).toBe(false);
    }
  });

  it('keeps the group role harmless', async () => {
    const res = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcanlogin: boolean }>(
      'SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = $1',
      [GROUP_ROLE],
    );
    expect(res.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, rolcanlogin: false });
  });
});