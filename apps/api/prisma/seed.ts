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
    primaryColor: '#4f46e5',
    description: 'فروشگاه نمونه‌ی ما؛ پوشاک و لوازم دیجیتال با ارسال سریع.',
  },
  {
    name: 'فروشگاه اکمی',
    subdomain: 'acme',
    plan: 'FREE' as const,
    owner: { email: 'owner@acme.test', name: 'مالک اکمی' },
    editor: { email: 'editor@acme.test', name: 'ویراستار اکمی' },
    domain: 'www.acme.test',
    primaryColor: '#e11d48',
    description: 'فروشگاه اکمی؛ رنگ و ظاهر متفاوت برای تست چندفروشگاهی.',
  },
];

interface SeedProduct {
  title: string;
  slug: string;
  description: string;
  status: 'ACTIVE' | 'DRAFT';
  category: string;
  variants: Array<{
    title: string;
    sku: string;
    price: number;
    compareAtPrice?: number;
    quantity: number;
  }>;
}

const catalogCategories = [
  { slug: 'پوشاک', name: 'پوشاک', parent: undefined },
  { slug: 'لوازم-دیجیتال', name: 'لوازم دیجیتال', parent: undefined },
  { slug: 'هدفون', name: 'هدفون', parent: 'لوازم-دیجیتال' },
];

const catalogProducts: SeedProduct[] = [
  {
    title: 'تیشرت نخی',
    slug: 'تیشرت-نخی',
    description: 'تیشرت نخی ۲۴ لا با دوخت مقاوم.',
    status: 'ACTIVE',
    category: 'پوشاک',
    variants: [
      { title: 'S', sku: 'TS-S', price: 450_000, quantity: 10 },
      { title: 'M', sku: 'TS-M', price: 450_000, quantity: 8 },
      { title: 'L', sku: 'TS-L', price: 450_000, quantity: 0 },
    ],
  },
  {
    title: 'شلوار جین',
    slug: 'شلوار-جین',
    description: 'شلوار جین راسته.',
    status: 'ACTIVE',
    category: 'پوشاک',
    variants: [
      { title: 'پیش‌فرض', sku: 'JN-1', price: 1_200_000, compareAtPrice: 1_500_000, quantity: 5 },
    ],
  },
  {
    title: 'هدفون بلوتوثی',
    slug: 'هدفون-بلوتوثی',
    description: 'هدفون بی‌سیم با ۲۰ ساعت شارژدهی.',
    status: 'ACTIVE',
    category: 'هدفون',
    variants: [{ title: 'پیش‌فرض', sku: 'HP-1', price: 2_300_000, quantity: 12 }],
  },
  {
    title: 'پاوربانک ۲۰۰۰۰',
    slug: 'پاوربانک-20000',
    description: 'پیش‌نویس؛ در ویترین دیده نمی‌شود.',
    status: 'DRAFT',
    category: 'لوازم-دیجیتال',
    variants: [{ title: 'پیش‌فرض', sku: 'PB-1', price: 980_000, quantity: 20 }],
  },
];

async function seedCatalog(tenantId: string) {
  const categoryIds = new Map<string, string>();

  for (const [position, c] of catalogCategories.entries()) {
    const row = await prisma.category.upsert({
      where: { tenantId_slug: { tenantId, slug: c.slug } },
      update: {},
      create: {
        tenantId,
        name: c.name,
        slug: c.slug,
        parentId: c.parent ? (categoryIds.get(c.parent) ?? null) : null,
        position,
      },
    });
    categoryIds.set(c.slug, row.id);
  }

  for (const p of catalogProducts) {
    const exists = await prisma.product.findUnique({
      where: { tenantId_slug: { tenantId, slug: p.slug } },
      select: { id: true },
    });
    if (exists) continue;

    const prices = p.variants.map((v) => v.price);
    const product = await prisma.product.create({
      data: {
        tenantId,
        title: p.title,
        slug: p.slug,
        description: p.description,
        status: p.status,
        categoryId: categoryIds.get(p.category) ?? null,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      },
    });

    for (const [position, v] of p.variants.entries()) {
      const variant = await prisma.variant.create({
        data: {
          tenantId,
          productId: product.id,
          title: v.title,
          sku: v.sku,
          price: v.price,
          compareAtPrice: v.compareAtPrice ?? null,
          position,
        },
      });
      await prisma.inventory.create({
        data: { tenantId, variantId: variant.id, quantity: v.quantity },
      });
    }
  }
  console.log('✔ catalog seeded for demo');
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed must not run in production');
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  for (const s of stores) {
    const settings = {
      primaryColor: s.primaryColor,
      description: s.description,
      currency: 'IRT',
    };

    const tenant = await prisma.tenant.upsert({
      where: { subdomain: s.subdomain },
      update: { settings },
      create: {
        name: s.name,
        subdomain: s.subdomain,
        plan: s.plan,
        settings,
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

  const demo = await prisma.tenant.findUniqueOrThrow({ where: { subdomain: 'demo' } });
  await seedCatalog(demo.id);

  console.log(`\nDev password for all users: ${DEV_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
