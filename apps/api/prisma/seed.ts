import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

config({ path: ['.env', '../../.env'] });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEV_PASSWORD = 'Password123!';

const stores = [
  {
    name: 'فروشگاه دمو',
    subdomain: 'demo',
    plan: 'PRO' as const,
    owner: { email: 'owner@demo.test', name: 'مالک دمو' },
    editor: { email: 'editor@demo.test', name: 'ویراستار دمو' },
    domain: 'shop.demo.test',
  },
  {
    name: 'فروشگاه اکمی',
    subdomain: 'acme',
    plan: 'FREE' as const,
    owner: { email: 'owner@acme.test', name: 'مالک اکمی' },
    editor: { email: 'editor@acme.test', name: 'ویراستار اکمی' },
    domain: 'www.acme.test',
  },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed must not run in production');
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  for (const s of stores) {
    const tenant = await prisma.tenant.upsert({
      where: { subdomain: s.subdomain },
      update: {},
      create: {
        name: s.name,
        subdomain: s.subdomain,
        plan: s.plan,
        settings: { primaryColor: '#4f46e5', currency: 'IRT' },
      },
    });

    await prisma.user.upsert({
      where: { email: s.editor.email },
      update: {},
      create: {
        tenantId: tenant.id,
        email: s.editor.email,
        name: s.editor.name,
        passwordHash,
        role: 'EDITOR',
      },
    });

    await prisma.domain.upsert({
      where: { hostname: s.domain },
      update: {},
      create: {
        tenantId: tenant.id,
        hostname: s.domain,
        isPrimary: true,
        status: 'VERIFIED',
        verificationToken: `seed-${s.subdomain}-token`,
        verifiedAt: new Date(),
      },
    });

    console.log(`✔ ${s.subdomain}  (${s.owner.email})`);
  }

  console.log(`\nDev password for all users: ${DEV_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
