import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/prisma/client';

/** کد یکتا برای هر فایل تست؛ تداخل بین اجراها را از بین می‌برد */
export const RUN = randomUUID().replace(/-/g, '').slice(0, 8);

export const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN ?? 'localhost').toLowerCase();

/** یک فروشگاه کامل: tenant + owner + editor + دامنه‌ی اختصاصی تأییدشده */
export async function createFixture(prisma: PrismaClient, tag: string) {
  const tenant = await prisma.tenant.create({
    data: { name: `Tenant ${tag}`, subdomain: `t4${tag}${RUN}` },
  });
  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `owner-${tag}-${RUN}@test.dev`,
      name: `Owner ${tag}`,
      passwordHash: 'x',
      role: 'OWNER',
    },
  });
  const editor = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `editor-${tag}-${RUN}@test.dev`,
      name: `Editor ${tag}`,
      passwordHash: 'x',
      role: 'EDITOR',
    },
  });
  const domain = await prisma.domain.create({
    data: {
      tenantId: tenant.id,
      hostname: `${tag}${RUN}.example.test`,
      status: 'VERIFIED',
      verificationToken: randomUUID(),
    },
  });
  return { tenant, owner, editor, domain };
}

export type TenantFixture = Awaited<ReturnType<typeof createFixture>>;

export const subdomainHost = (f: TenantFixture) => `${f.tenant.subdomain}.${PLATFORM_DOMAIN}`;

/** حذف tenant، کاربران و دامنه‌ها را هم پاک می‌کند (onDelete: Cascade) */
export async function cleanupFixtures(prisma: PrismaClient, fixtures: TenantFixture[]) {
  await prisma.tenant.deleteMany({ where: { id: { in: fixtures.map((f) => f.tenant.id) } } });
}