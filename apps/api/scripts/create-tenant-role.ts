/**
 * اجرا: npm run db:tenant-role -w apps/api
 * بعد از هر «db:deploy» (و روی سرور تازه) نقش بدون BYPASSRLS را می‌سازد.
 */
import { config } from 'dotenv';
import { ensureTenantRole } from './tenant-role';

config({ path: ['.env', '../../.env'], quiet: true });

async function main() {
  const systemUrl = process.env.DATABASE_URL;
  const tenantUrl = process.env.TENANT_DATABASE_URL;
  if (!systemUrl) throw new Error('DATABASE_URL is not set');
  if (!tenantUrl) {
    console.log('TENANT_DATABASE_URL is not set; nothing to do (row level security is not enforced)');
    return;
  }
  const role = await ensureTenantRole(systemUrl, tenantUrl);
  console.log(`✔ tenant role "${role}" is ready (no superuser, no BYPASSRLS)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});