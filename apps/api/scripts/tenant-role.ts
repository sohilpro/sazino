import { Client } from 'pg';

const GROUP_ROLE = 'myapp_tenant';

/**
 * نقش ورود tenant (از TENANT_DATABASE_URL) را می‌سازد یا به‌روز می‌کند و عضو گروه myapp_tenant می‌کند.
 * هیچ‌وقت SUPERUSER یا BYPASSRLS نیست؛ اگر بود، خطا می‌دهد. چند بار اجرا شدنش بی‌خطر است.
 */
export async function ensureTenantRole(systemUrl: string, tenantUrl: string): Promise<string> {
  const tenant = new URL(tenantUrl);
  const role = decodeURIComponent(tenant.username);
  const password = decodeURIComponent(tenant.password);
  if (!role || !password) throw new Error('TENANT_DATABASE_URL must include a user and a password');
  if (decodeURIComponent(new URL(systemUrl).username) === role) {
    throw new Error('TENANT_DATABASE_URL must use a different role than DATABASE_URL');
  }

  const client = new Client({ connectionString: systemUrl });
  await client.connect();
  try {
    const format = async (template: string, ...values: string[]) =>
      (
        await client.query<{ sql: string }>('SELECT format($1, VARIADIC $2::text[]) AS sql', [
          template,
          values,
        ])
      ).rows[0]!.sql;

    // گروه (برای دیتابیسِ بازیابی‌شده روی سرور تازه هم لازم است)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${GROUP_ROLE}') THEN
          CREATE ROLE ${GROUP_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$`);
    await client.query(
      await format(
        `GRANT CONNECT ON DATABASE %I TO ${GROUP_ROLE}`,
        (await client.query('SELECT current_database() AS db')).rows[0].db,
      ),
    );
    await client.query(`GRANT USAGE ON SCHEMA public TO ${GROUP_ROLE}`);

    const exists = (await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rowCount! > 0;
    await client.query(
      await format(
        `${exists ? 'ALTER ROLE' : 'CREATE ROLE'} %I WITH LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
        role,
        password,
      ),
    );
    await client.query(await format(`GRANT ${GROUP_ROLE} TO %I`, role));

    const check = await client.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1',
      [role],
    );
    const row = check.rows[0];
    if (!row || row.rolsuper || row.rolbypassrls) {
      throw new Error(`role "${role}" must not be a superuser or bypass row level security`);
    }
    return role;
  } finally {
    await client.end();
  }
}