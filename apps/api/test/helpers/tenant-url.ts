/**
 * در تست‌ها TENANT_DATABASE_URL همیشه روی نقش بدون BYPASSRLS است، پس هر تست e2e
 * با Row Level Security واقعی اجرا می‌شود (fixtureها با PrismaService و نقش سیستمی ساخته می‌شوند).
 * برای مقایسه: RLS_TESTS=off
 */
export const TEST_TENANT_ROLE = 'myapp_rls';
export const TEST_TENANT_PASSWORD = 'myapp_rls_test_password';

export function deriveTenantUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.username = TEST_TENANT_ROLE;
  url.password = TEST_TENANT_PASSWORD;
  return url.toString();
}