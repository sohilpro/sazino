import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : files(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

const sources = files(SRC).map((file) => ({
  path: relative(SRC, file).replaceAll('\\', '/'),
  text: readFileSync(file, 'utf8'),
}));

/**
 * PrismaService فیلتر tenant ندارد. فقط این فایل‌ها حق استفاده از آن را دارند
 * (احراز هویت، resolver، سوپر ادمین، jobها). فایل تازه‌ای که اینجا نیست باید بازبینی شود.
 */
const SYSTEM_CLIENT_ALLOWED = [
  'admin/admin-audit.service.ts',
  'admin/admin-auth.service.ts',
  'admin/admin-tenants.service.ts',
  'auth/auth.service.ts',
  'auth/token.service.ts',
  'domains/domains.service.ts',
  'maintenance/maintenance.service.ts',
  'plans/plans.service.ts',
  'prisma/prisma.module.ts',
  'prisma/prisma.service.ts',
  'tenants/store-settings.service.ts',
  'tenants/tenant-client.ts',
  'tenants/tenant-resolver.ts',
  'tenants/tenant-scope.ts',
  'tenants/tenant-status.service.ts',
  'tenants/tenants.module.ts',
];

/** SQL خام فیلتر خودکار tenant را دور می‌زند؛ هر فایل باید tenant_id را صریح بنویسد */
const RAW_SQL_ALLOWED = [
  'orders/variant-lock.ts',
  // set_config('app.tenant_id', ...) برای Row Level Security
  'tenants/tenant-client.ts',
];

describe('system client and raw SQL usage', () => {
  it('only the reviewed files use PrismaService', () => {
    const users = sources
      .filter((s) => /\bPrismaService\b/.test(s.text))
      .map((s) => s.path)
      .sort();
    expect(users).toEqual([...SYSTEM_CLIENT_ALLOWED].sort());
  });

  it('only the reviewed files use raw SQL', () => {
    const users = sources
      .filter((s) => /\$(queryRaw|executeRaw)(Unsafe)?\b/.test(s.text))
      .map((s) => s.path)
      .sort();
    expect(users).toEqual([...RAW_SQL_ALLOWED].sort());
  });

  it('every raw query names tenant_id explicitly', () => {
    for (const path of RAW_SQL_ALLOWED) {
      expect(sources.find((s) => s.path === path)?.text, path).toContain('tenant_id');
    }
  });

  it('no feature service imports the tenant resolver internals or builds its own Prisma client', () => {
    const offenders = sources.filter((s) => /new PrismaClient\(/.test(s.text)).map((s) => s.path);
    expect(offenders).toEqual([]);
  });
});
