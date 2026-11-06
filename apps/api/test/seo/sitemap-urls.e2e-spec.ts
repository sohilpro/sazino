import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SeoService } from '../../src/seo/seo.service';
import { TenantContext } from '../../src/tenants/tenant-context';
import { createTestApp } from '../helpers/create-app';
import {
  cleanupFixtures,
  createFixture,
  subdomainHost,
  type TenantFixture,
} from '../helpers/fixtures';
import { createProduct } from '../helpers/shop';

describe('Sitemap URLs', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let A: TenantFixture;
  let B: TenantFixture;
  const slugs: Record<string, string> = {};

  const paths = async (f: TenantFixture) => {
    const res = await request(app.getHttpServer())
      .get('/api/storefront/sitemap-urls')
      .set('Host', subdomainHost(f))
      .expect(200);
    return (res.body as { urls: Array<{ path: string }> }).urls.map((u) => u.path);
  };

  const mkCategory = (f: TenantFixture, slug: string) =>
    prisma.category.create({ data: { tenantId: f.tenant.id, name: slug, slug } });
  const mkPage = (f: TenantFixture, slug: string, published: boolean) =>
    prisma.page.create({
      data: {
        tenantId: f.tenant.id,
        slug,
        title: slug,
        publishedAt: published ? new Date() : null,
      },
    });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    A = await createFixture(prisma, 'sa');
    B = await createFixture(prisma, 'sb');

    const withActive = await mkCategory(A, 'with-active');
    const onlyInactive = await mkCategory(A, 'only-inactive');
    await mkCategory(A, 'empty-cat');

    const live = await createProduct(prisma, A, { status: 'ACTIVE' });
    const live2 = await createProduct(prisma, A, { status: 'ACTIVE' });
    const draft = await createProduct(prisma, A, { status: 'DRAFT' });
    const archived = await createProduct(prisma, A, { status: 'ARCHIVED' });
    await prisma.product.update({ where: { id: live.product.id }, data: { categoryId: withActive.id } });
    await prisma.product.update({ where: { id: draft.product.id }, data: { categoryId: onlyInactive.id } });
    Object.assign(slugs, {
      live: live.product.slug,
      live2: live2.product.slug,
      draft: draft.product.slug,
      archived: archived.product.slug,
    });

    await mkPage(A, 'about', true);
    await mkPage(A, 'secret-draft', false);
    await mkPage(A, 'home', true);

    slugs.bProduct = (await createProduct(prisma, B, { status: 'ACTIVE' })).product.slug;
    await mkPage(B, 'b-only-page', true);
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  it('lists home, published pages, categories with active products and active products only', async () => {
    const list = await paths(A);
    expect(list).toEqual(
      expect.arrayContaining([
        '/',
        '/p/about',
        '/categories/with-active',
        `/products/${slugs.live}`,
        `/products/${slugs.live2}`,
      ]),
    );
    expect(list).not.toContain('/p/secret-draft');
    expect(list).not.toContain(`/products/${slugs.draft}`);
    expect(list).not.toContain(`/products/${slugs.archived}`);
    expect(list).not.toContain('/categories/only-inactive');
    expect(list).not.toContain('/categories/empty-cat');
  });

  it('maps the home page to "/" exactly once', async () => {
    const list = await paths(A);
    expect(list.filter((p) => p === '/')).toHaveLength(1);
    expect(list).not.toContain('/p/home');
  });

  it('never leaks another store', async () => {
    const a = await paths(A);
    const b = await paths(B);
    expect(a).not.toContain(`/products/${slugs.bProduct}`);
    expect(a).not.toContain('/p/b-only-page');
    expect(b).toEqual(expect.arrayContaining([`/products/${slugs.bProduct}`, '/p/b-only-page']));
    expect(b).not.toContain(`/products/${slugs.live}`);
  });

  it('truncates at the limit and says so', async () => {
    const service = app.get(SeoService);
    const result = await app.get(TenantContext).runAs(A.tenant.id, () => service.list(3));
    expect(result.urls).toHaveLength(3);
    expect(result.truncated).toBe(true);
  });

  it('answers 404 for an unknown store', async () => {
    await request(app.getHttpServer())
      .get('/api/storefront/sitemap-urls')
      .set('Host', 'no-such-store.localhost')
      .expect(404);
  });

  it('exposes canonicalUrl on /api/store', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/store')
      .set('Host', subdomainHost(A))
      .expect(200);
    expect(res.body.canonicalUrl).toContain(A.tenant.subdomain);
    expect(res.body.canonicalUrl).not.toMatch(/\/$/);
  });
});