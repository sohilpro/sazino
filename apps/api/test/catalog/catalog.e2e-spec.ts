import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  cleanupFixtures,
  createFixture,
  RUN,
  subdomainHost,
  type TenantFixture,
} from '../helpers/fixtures';

describe('Catalog API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  let A: TenantFixture;
  let B: TenantFixture;
  let C: TenantFixture;
  let tokenA = '';
  let tokenAEditor = '';
  let tokenB = '';
  let tokenC = '';

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) =>
      http().post(url).set('Authorization', `Bearer ${token}`).send(body),
    patch: (url: string, body: object = {}) =>
      http().patch(url).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url: string) => http().delete(url).set('Authorization', `Bearer ${token}`),
  });
  const sign = (u: { id: string; tenantId: string; role: string }) =>
    jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });

  const variant = (price: number, extra: Record<string, unknown> = {}) => ({
    title: 'پیش‌فرض',
    price,
    quantity: 5,
    ...extra,
  });
  const newProduct = async (token: string, body: Record<string, unknown>) =>
    (await as(token).post('/api/products', body).expect(201)).body;

  // وضعیت مشترک بین تست‌های فروشگاه A
  let rootCat!: { id: string; slug: string };
  let rootCat2!: { id: string; slug: string };
  let childCat!: { id: string; slug: string };
  let P1!: { id: string; slug: string; variants: Array<{ id: string }> };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService, { strict: false });

    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');
    C = await createFixture(prisma, 'c');
    tokenA = await sign(A.owner);
    tokenAEditor = await sign(A.editor);
    tokenB = await sign(B.owner);
    tokenC = await sign(C.owner);
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, [A, B, C]);
    await app.close();
  });

  // ─────────────────────────── دسته‌بندی ───────────────────────────
  describe('categories', () => {
    it('creates a category with an auto-generated Persian slug', async () => {
      const res = await as(tokenA).post('/api/categories', { name: 'لوازم دیجیتال' }).expect(201);
      expect(res.body).toMatchObject({
        name: 'لوازم دیجیتال',
        slug: 'لوازم-دیجیتال',
        parentId: null,
      });
      rootCat = res.body;
    });

    it('adds a numeric suffix when the generated slug is taken', async () => {
      const res = await as(tokenA).post('/api/categories', { name: 'لوازم دیجیتال' }).expect(201);
      expect(res.body.slug).toBe('لوازم-دیجیتال-2');
      rootCat2 = res.body;
    });

    it('rejects an explicit duplicate slug with 409', async () => {
      await as(tokenA)
        .post('/api/categories', { name: 'x y', slug: rootCat.slug })
        .expect(409);
    });

    it('allows the same slug in another tenant', async () => {
      const res = await as(tokenB)
        .post('/api/categories', { name: 'دسته B', slug: rootCat.slug })
        .expect(201);
      expect(res.body.slug).toBe(rootCat.slug);
    });

    it('supports a child category', async () => {
      const res = await as(tokenA)
        .post('/api/categories', { name: 'هدفون', parentId: rootCat.id })
        .expect(201);
      expect(res.body.parentId).toBe(rootCat.id);
      childCat = res.body;
    });

    it('rejects a third nesting level', async () => {
      await as(tokenA)
        .post('/api/categories', { name: 'زیر هدفون', parentId: childCat.id })
        .expect(400);
    });

    it('rejects making a category with children a child itself', async () => {
      await as(tokenA).patch(`/api/categories/${rootCat.id}`, { parentId: rootCat2.id }).expect(400);
    });

    it('rejects a parent that belongs to another tenant', async () => {
      await as(tokenB)
        .post('/api/categories', { name: 'نفوذی', parentId: rootCat.id })
        .expect(400);
    });

    it('lists only the categories of the current tenant', async () => {
      const a = await as(tokenA).get('/api/categories').expect(200);
      const b = await as(tokenB).get('/api/categories').expect(200);
      const idsA = (a.body as Array<{ id: string }>).map((c) => c.id);
      const idsB = (b.body as Array<{ id: string }>).map((c) => c.id);
      expect(idsA).toContain(rootCat.id);
      expect(idsB).not.toContain(rootCat.id);
      expect(idsA.some((id) => idsB.includes(id))).toBe(false);
    });

    it('hides categories of another tenant (404 on read, update and delete)', async () => {
      await as(tokenB).get(`/api/categories/${rootCat.id}`).expect(404);
      await as(tokenB).patch(`/api/categories/${rootCat.id}`, { name: 'hacked' }).expect(404);
      await as(tokenB).delete(`/api/categories/${rootCat.id}`).expect(404);
      const after = await as(tokenA).get(`/api/categories/${rootCat.id}`).expect(200);
      expect(after.body.name).toBe('لوازم دیجیتال');
    });

    it('refuses to delete a category that has children', async () => {
      await as(tokenA).delete(`/api/categories/${rootCat.id}`).expect(409);
    });

    it('forbids an EDITOR from deleting a category', async () => {
      await as(tokenAEditor).delete(`/api/categories/${childCat.id}`).expect(403);
    });

    it('validates the payload', async () => {
      await as(tokenA).post('/api/categories', { name: 'a' }).expect(400);
      await as(tokenA).post('/api/categories', { name: 'نام', slug: 'bad slug' }).expect(400);
      await as(tokenA).post('/api/categories', { name: 'نام', foo: 1 }).expect(400);
    });
  });

  // ─────────────────────────── محصول ───────────────────────────
  describe('products', () => {
    it('creates a product with variants and inventory', async () => {
      const res = await as(tokenA)
        .post('/api/products', {
          title: 'گوشی تست',
          status: 'ACTIVE',
          categoryId: childCat.id,
          variants: [
            {
              title: '128GB',
              sku: `sku-1-${RUN}`,
              price: 1_000_000,
              compareAtPrice: 1_200_000,
              quantity: 5,
            },
            { title: '256GB', price: 1_500_000, quantity: 0 },
          ],
        })
        .expect(201);

      expect(res.body).toMatchObject({
        title: 'گوشی تست',
        slug: 'گوشی-تست',
        status: 'ACTIVE',
        minPrice: 1_000_000,
        maxPrice: 1_500_000,
        inStock: true,
      });
      expect(res.body.category.id).toBe(childCat.id);
      expect(res.body.variants).toHaveLength(2);
      expect(res.body.variants[0]).toMatchObject({ quantity: 5, inStock: true });
      expect(res.body.variants[1]).toMatchObject({ quantity: 0, inStock: false });
      P1 = res.body;
    });

    it('defaults to DRAFT and a default variant title', async () => {
      const res = await as(tokenA)
        .post('/api/products', { title: 'محصول ساده', variants: [{ price: 5000 }] })
        .expect(201);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.variants[0].title).toBe('پیش‌فرض');
      expect(res.body.variants[0].quantity).toBe(0);
    });

    it('adds a numeric suffix when the generated slug is taken', async () => {
      const res = await as(tokenA)
        .post('/api/products', { title: 'گوشی تست', variants: [variant(1000)] })
        .expect(201);
      expect(res.body.slug).toBe('گوشی-تست-2');
    });

    it('enforces slug uniqueness per tenant only', async () => {
      const slug = `same-slug-${RUN}`;
      await as(tokenA).post('/api/products', { title: 'اول', slug, variants: [variant(1)] }).expect(201);
      await as(tokenA).post('/api/products', { title: 'دوم', slug, variants: [variant(1)] }).expect(409);
      await as(tokenB).post('/api/products', { title: 'سوم', slug, variants: [variant(1)] }).expect(201);
    });

    it('enforces SKU uniqueness per tenant only', async () => {
      const sku = `sku-1-${RUN}`;
      await as(tokenA)
        .post('/api/products', { title: 'تکراری', variants: [variant(1, { sku })] })
        .expect(409);
      await as(tokenB)
        .post('/api/products', { title: 'مجاز', variants: [variant(1, { sku })] })
        .expect(201);
    });

    it('validates the payload', async () => {
      const bad = (body: object) => as(tokenA).post('/api/products', body).expect(400);
      await bad({ title: 'بدون تنوع', variants: [] });
      await bad({ title: 'قیمت منفی', variants: [variant(-1)] });
      await bad({ title: 'تخفیف غلط', variants: [variant(1000, { compareAtPrice: 1000 })] });
      await bad({ title: 'x', variants: [variant(1000)] });
      await bad({ title: 'فیلد اضافه', foo: 1, variants: [variant(1000)] });
      await bad({ title: 'وضعیت غلط', status: 'NOPE', variants: [variant(1000)] });
      await bad({ title: 'دسته غلط', categoryId: 'not-a-uuid', variants: [variant(1000)] });
      await bad({
        title: 'SKU تکراری',
        variants: [variant(1, { sku: 'dup' }), variant(2, { sku: 'dup' })],
      });
    });

    it('rejects a category from another tenant', async () => {
      await as(tokenB)
        .post('/api/products', { title: 'نفوذی', categoryId: childCat.id, variants: [variant(1)] })
        .expect(400);
    });

    it('updates a product without changing its slug', async () => {
      const res = await as(tokenA)
        .patch(`/api/products/${P1.id}`, { title: 'عنوان جدید', status: 'DRAFT' })
        .expect(200);
      expect(res.body).toMatchObject({ title: 'عنوان جدید', slug: P1.slug, status: 'DRAFT' });
    });

    it('can remove the category with null', async () => {
      const res = await as(tokenA).patch(`/api/products/${P1.id}`, { categoryId: null }).expect(200);
      expect(res.body.category).toBeNull();
      await as(tokenA).patch(`/api/products/${P1.id}`, { categoryId: childCat.id }).expect(200);
    });

    it('returns 400 for a malformed id and 404 for an unknown id', async () => {
      await as(tokenA).get('/api/products/not-a-uuid').expect(400);
      await as(tokenA).get('/api/products/019a0000-0000-7000-8000-000000000000').expect(404);
    });
  });

  // ─────────────────────────── ایزوله‌سازی ───────────────────────────
  describe('tenant isolation', () => {
    it('hides products of another tenant from reads, updates and deletes', async () => {
      await as(tokenB).get(`/api/products/${P1.id}`).expect(404);
      await as(tokenB).patch(`/api/products/${P1.id}`, { title: 'hacked' }).expect(404);
      await as(tokenB).delete(`/api/products/${P1.id}`).expect(404);

      const after = await as(tokenA).get(`/api/products/${P1.id}`).expect(200);
      expect(after.body.title).toBe('عنوان جدید');
    });

    it('does not list products of another tenant', async () => {
      const b = await as(tokenB).get('/api/products?limit=100').expect(200);
      const ids = (b.body.items as Array<{ id: string }>).map((p) => p.id);
      expect(ids).not.toContain(P1.id);
    });

    it('cannot touch variants or inventory of another tenant', async () => {
      const v0 = P1.variants[0].id;
      await as(tokenB).post(`/api/products/${P1.id}/variants`, variant(1)).expect(404);
      await as(tokenB).patch(`/api/products/${P1.id}/variants/${v0}`, { price: 1 }).expect(404);
      await as(tokenB).delete(`/api/products/${P1.id}/variants/${v0}`).expect(404);
      await as(tokenB)
        .patch(`/api/products/${P1.id}/variants/${v0}/inventory`, { quantity: 999 })
        .expect(404);

      const inv = await prisma.inventory.findFirst({ where: { variantId: v0 } });
      expect(inv?.quantity).toBe(5);
    });

    it('cannot reach a variant through a product of the same tenant but wrong parent', async () => {
      const other = await newProduct(tokenA, { title: 'محصول دیگر', variants: [variant(10)] });
      await as(tokenA)
        .patch(`/api/products/${other.id}/variants/${P1.variants[0].id}`, { price: 1 })
        .expect(404);
    });

    it('the database refuses a variant that mixes tenants (composite foreign key)', async () => {
      await expect(
        prisma.variant.create({
          data: { tenantId: B.tenant.id, productId: P1.id, title: 'x', price: 1 },
        }),
      ).rejects.toBeDefined();
    });
  });

  // ─────────────────────────── تنوع و موجودی ───────────────────────────
  describe('variants and inventory', () => {
    let v0 = '';
    let v1 = '';
    let v2 = '';

    it('adds a variant and refreshes the price range', async () => {
      v0 = P1.variants[0].id;
      v1 = P1.variants[1].id;
      const res = await as(tokenA)
        .post(`/api/products/${P1.id}/variants`, { title: '512GB', price: 2_000_000, quantity: 2 })
        .expect(201);
      expect(res.body.variants).toHaveLength(3);
      expect(res.body.minPrice).toBe(1_000_000);
      expect(res.body.maxPrice).toBe(2_000_000);
      v2 = res.body.variants[2].id;
    });

    it('updates a variant and refreshes the price range', async () => {
      const res = await as(tokenA)
        .patch(`/api/products/${P1.id}/variants/${v0}`, { price: 900_000, compareAtPrice: null })
        .expect(200);
      expect(res.body.minPrice).toBe(900_000);
      expect(res.body.variants[0].compareAtPrice).toBeNull();
    });

    it('rejects a compare-at price that is not above the price', async () => {
      await as(tokenA)
        .patch(`/api/products/${P1.id}/variants/${v0}`, { compareAtPrice: 100 })
        .expect(400);
    });

    it('sets inventory quantity', async () => {
      const res = await as(tokenA)
        .patch(`/api/products/${P1.id}/variants/${v1}/inventory`, { quantity: 7 })
        .expect(200);
      expect(res.body.variants[1]).toMatchObject({ quantity: 7, inStock: true });
    });

    it('treats backorder as in stock', async () => {
      const res = await as(tokenA)
        .patch(`/api/products/${P1.id}/variants/${v1}/inventory`, {
          quantity: 0,
          allowBackorder: true,
        })
        .expect(200);
      expect(res.body.variants[1]).toMatchObject({ quantity: 0, allowBackorder: true, inStock: true });
    });

    it('validates inventory input', async () => {
      const url = `/api/products/${P1.id}/variants/${v1}/inventory`;
      await as(tokenA).patch(url, { quantity: -1 }).expect(400);
      await as(tokenA).patch(url, {}).expect(400);
    });

    it('removes a variant (OWNER) and refreshes the price range', async () => {
      const res = await as(tokenA).delete(`/api/products/${P1.id}/variants/${v2}`).expect(200);
      expect(res.body.variants).toHaveLength(2);
      expect(res.body.maxPrice).toBe(1_500_000);
    });

    it('forbids an EDITOR from removing a variant', async () => {
      await as(tokenAEditor).delete(`/api/products/${P1.id}/variants/${v1}`).expect(403);
    });

    it('never removes the last variant', async () => {
      const single = await newProduct(tokenA, { title: 'تک تنوعی', variants: [variant(10)] });
      await as(tokenA)
        .delete(`/api/products/${single.id}/variants/${single.variants[0].id}`)
        .expect(409);
    });
  });

  // ─────────────────────────── نقش‌ها و حذف ───────────────────────────
  describe('roles and deletion', () => {
    it('lets an EDITOR create a product but not delete it', async () => {
      const created = await newProduct(tokenAEditor, { title: 'ساخته‌ی ویراستار', variants: [variant(1)] });
      await as(tokenAEditor).delete(`/api/products/${created.id}`).expect(403);
      await as(tokenA).delete(`/api/products/${created.id}`).expect(204);
      await as(tokenA).get(`/api/products/${created.id}`).expect(404);
    });

    it('deleting a product removes its variants and inventory (cascade)', async () => {
      const created = await newProduct(tokenA, { title: 'برای حذف', variants: [variant(1), variant(2)] });
      await as(tokenA).delete(`/api/products/${created.id}`).expect(204);
      expect(await prisma.variant.count({ where: { productId: created.id } })).toBe(0);
    });

    it('deleting a category leaves its products uncategorised', async () => {
      const cat = (await as(tokenA).post('/api/categories', { name: 'موقت' }).expect(201)).body;
      const product = await newProduct(tokenA, {
        title: 'محصول موقت',
        categoryId: cat.id,
        variants: [variant(1)],
      });
      await as(tokenA).delete(`/api/categories/${cat.id}`).expect(204);
      const after = await as(tokenA).get(`/api/products/${product.id}`).expect(200);
      expect(after.body.category).toBeNull();
    });
  });

  // ─────────────────────────── لیست، فیلتر، مرتب‌سازی ───────────────────────────
  describe('listing (tenant C)', () => {
    let gadgets!: { id: string; slug: string };
    let cases!: { id: string; slug: string };
    const titles = (body: { items: Array<{ title: string }> }) => body.items.map((p) => p.title);

    beforeAll(async () => {
      gadgets = (await as(tokenC).post('/api/categories', { name: 'Gadgets' }).expect(201)).body;
      cases = (
        await as(tokenC).post('/api/categories', { name: 'Cases', parentId: gadgets.id }).expect(201)
      ).body;

      // به ترتیب ساخت (قدیمی ← جدید)
      await newProduct(tokenC, { title: 'Alpha Phone', status: 'ACTIVE', variants: [variant(300)] });
      await newProduct(tokenC, { title: 'Alpha Watch', status: 'ACTIVE', variants: [variant(100)] });
      await newProduct(tokenC, {
        title: 'Beta Case',
        status: 'DRAFT',
        categoryId: gadgets.id,
        variants: [variant(200, { sku: `case-${RUN}` })],
      });
      await newProduct(tokenC, { title: 'Gamma Cable', status: 'ARCHIVED', variants: [variant(50)] });
      await newProduct(tokenC, {
        title: 'Delta Charger',
        status: 'ACTIVE',
        categoryId: gadgets.id,
        variants: [variant(400)],
      });
      await newProduct(tokenC, {
        title: 'Epsilon Case',
        status: 'ACTIVE',
        categoryId: cases.id,
        variants: [variant(250)],
      });
    });

    it('returns the newest first by default', async () => {
      const res = await as(tokenC).get('/api/products').expect(200);
      expect(titles(res.body)).toEqual([
        'Epsilon Case',
        'Delta Charger',
        'Gamma Cable',
        'Beta Case',
        'Alpha Watch',
        'Alpha Phone',
      ]);
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 6, totalPages: 1 });
    });

    it('paginates', async () => {
      const res = await as(tokenC).get('/api/products?limit=2&page=2').expect(200);
      expect(titles(res.body)).toEqual(['Gamma Cable', 'Beta Case']);
      expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 6, totalPages: 3 });

      const beyond = await as(tokenC).get('/api/products?limit=2&page=9').expect(200);
      expect(beyond.body.items).toEqual([]);
      expect(beyond.body.meta.total).toBe(6);
    });

    it('filters by status', async () => {
      const res = await as(tokenC).get('/api/products?status=DRAFT').expect(200);
      expect(titles(res.body)).toEqual(['Beta Case']);
    });

    it('filters by category', async () => {
      const res = await as(tokenC).get(`/api/products?categoryId=${gadgets.id}`).expect(200);
      expect(titles(res.body).sort()).toEqual(['Beta Case', 'Delta Charger']);
    });

    it('searches by title (case-insensitive) and by SKU', async () => {
      const byTitle = await as(tokenC).get('/api/products?q=ALPHA').expect(200);
      expect(titles(byTitle.body).sort()).toEqual(['Alpha Phone', 'Alpha Watch']);

      const bySku = await as(tokenC).get(`/api/products?q=CASE-${RUN}`).expect(200);
      expect(titles(bySku.body)).toEqual(['Beta Case']);
    });

    it('sorts by price and title', async () => {
      const asc = await as(tokenC).get('/api/products?sort=price_asc').expect(200);
      expect(titles(asc.body)).toEqual([
        'Gamma Cable',
        'Alpha Watch',
        'Beta Case',
        'Epsilon Case',
        'Alpha Phone',
        'Delta Charger',
      ]);

      const desc = await as(tokenC).get('/api/products?sort=price_desc').expect(200);
      expect(titles(desc.body)[0]).toBe('Delta Charger');

      const byTitle = await as(tokenC).get('/api/products?sort=title').expect(200);
      expect(titles(byTitle.body)).toEqual([
        'Alpha Phone',
        'Alpha Watch',
        'Beta Case',
        'Delta Charger',
        'Epsilon Case',
        'Gamma Cable',
      ]);
    });

    it('rejects invalid query values', async () => {
      await as(tokenC).get('/api/products?sort=random').expect(400);
      await as(tokenC).get('/api/products?limit=101').expect(400);
      await as(tokenC).get('/api/products?page=0').expect(400);
      await as(tokenC).get('/api/products?status=NOPE').expect(400);
    });

    it('counts all products per category in the panel', async () => {
      const res = await as(tokenC).get('/api/categories').expect(200);
      const byId = Object.fromEntries(
        (res.body as Array<{ id: string; productCount: number }>).map((c) => [c.id, c.productCount]),
      );
      expect(byId[gadgets.id]).toBe(2);
      expect(byId[cases.id]).toBe(1);
    });

    // ───────────── ویترین (عمومی) ─────────────
    describe('storefront', () => {
      const host = () => subdomainHost(C);
      const pub = (url: string, h: string = host()) => http().get(url).set('Host', h);

      it('lists only ACTIVE products and hides stock quantities', async () => {
        const res = await pub('/api/storefront/products').expect(200);
        expect(titles(res.body).sort()).toEqual([
          'Alpha Phone',
          'Alpha Watch',
          'Delta Charger',
          'Epsilon Case',
        ]);
        expect(res.body.meta.total).toBe(4);
        const first = res.body.items[0].variants[0];
        expect(first).not.toHaveProperty('quantity');
        expect(first).not.toHaveProperty('allowBackorder');
        expect(first).toHaveProperty('inStock');
      });

      it('filters by category slug including its sub-categories', async () => {
        const parent = await pub(`/api/storefront/products?categorySlug=${gadgets.slug}`).expect(200);
        expect(titles(parent.body).sort()).toEqual(['Delta Charger', 'Epsilon Case']);

        const child = await pub(`/api/storefront/products?categorySlug=${cases.slug}`).expect(200);
        expect(titles(child.body)).toEqual(['Epsilon Case']);
      });

      it('searches only among active products', async () => {
        const res = await pub('/api/storefront/products?q=case').expect(200);
        expect(titles(res.body)).toEqual(['Epsilon Case']); // Beta Case پیش‌نویس است
      });

      it('returns a product by slug but not drafts or archived ones', async () => {
        const ok = await pub('/api/storefront/products/alpha-phone').expect(200);
        expect(ok.body.title).toBe('Alpha Phone');
        await pub('/api/storefront/products/beta-case').expect(404);
        await pub('/api/storefront/products/gamma-cable').expect(404);
      });

      it('supports Persian slugs in the URL', async () => {
        const created = await newProduct(tokenC, {
          title: 'کتاب تست',
          status: 'ACTIVE',
          variants: [variant(10)],
        });
        expect(created.slug).toBe('کتاب-تست');
        const res = await pub(`/api/storefront/products/${encodeURIComponent(created.slug)}`).expect(200);
        expect(res.body.title).toBe('کتاب تست');
      });

      it('lists categories with the number of ACTIVE products only', async () => {
        const res = await pub('/api/storefront/categories').expect(200);
        const byId = Object.fromEntries(
          (res.body as Array<{ id: string; productCount: number }>).map((c) => [c.id, c.productCount]),
        );
        expect(byId[gadgets.id]).toBe(1); // Beta Case پیش‌نویس است
        expect(byId[cases.id]).toBe(1);
      });

      it('returns a category with its parent and children', async () => {
        const root = await pub(`/api/storefront/categories/${gadgets.slug}`).expect(200);
        expect(root.body.category.id).toBe(gadgets.id);
        expect(root.body.children.map((c: { id: string }) => c.id)).toEqual([cases.id]);

        const leaf = await pub(`/api/storefront/categories/${cases.slug}`).expect(200);
        expect(leaf.body.parent.id).toBe(gadgets.id);
      });

      it('never shows products of another store', async () => {
        const mine = await pub('/api/storefront/products?limit=100').expect(200);
        const myIds = new Set((mine.body.items as Array<{ id: string }>).map((p) => p.id));

        const other = await pub('/api/storefront/products?limit=100', subdomainHost(B)).expect(200);
        const otherIds = (other.body.items as Array<{ id: string }>).map((p) => p.id);
        expect(otherIds.some((id) => myIds.has(id))).toBe(false);
      });

      it('returns 404 when no store can be resolved from the host', async () => {
        await http().get('/api/storefront/products').expect(404);
      });
    });
  });
});