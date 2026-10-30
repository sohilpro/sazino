import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, subdomainHost, type TenantFixture } from '../helpers/fixtures';

const hero = (props: Record<string, unknown> = {}) => ({
  id: 'hero',
  type: 'hero',
  props: { title: 'عنوان اصلی', ...props },
});
const text = (content = 'متن آزمایشی', id = 'text') => ({ id, type: 'rich-text', props: { content } });
const grid = (props: Record<string, unknown> = {}) => ({ id: 'grid', type: 'product-grid', props: { limit: 4, ...props } });

describe('Pages (site builder)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let A: TenantFixture;
  let B: TenantFixture;
  let owner = '';
  let editor = '';
  let ownerB = '';

  const seller = (token: string) => ({
    get: (path: string) => request(app.getHttpServer()).get(`/api/pages${path}`).set('Authorization', `Bearer ${token}`),
    put: (path: string, body: object) =>
      request(app.getHttpServer()).put(`/api/pages${path}`).set('Authorization', `Bearer ${token}`).send(body),
    post: (path: string) =>
      request(app.getHttpServer()).post(`/api/pages${path}`).set('Authorization', `Bearer ${token}`),
    del: (path: string) =>
      request(app.getHttpServer()).delete(`/api/pages${path}`).set('Authorization', `Bearer ${token}`),
  });
  const storefront = (f: TenantFixture, path: string) =>
    request(app.getHttpServer()).get(`/api/storefront/pages${path}`).set('Host', subdomainHost(f));
  const createMedia = (f: TenantFixture) =>
    prisma.media.create({
      data: { tenantId: f.tenant.id, originalName: 'hero.jpg', mimeType: 'image/jpeg', sizeBytes: 1, width: 1600, height: 600, alt: 'بنر' },
    });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');

    const jwt = app.get(JwtService, { strict: false });
    const sign = (u: { id: string; tenantId: string; role: string }) =>
      jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });
    owner = await sign(A.owner);
    editor = await sign(A.editor);
    ownerB = await sign(B.owner);
  });

  afterAll(async () => {
    await redis.del(CACHE_PREFIX + subdomainHost(A), CACHE_PREFIX + subdomainHost(B));
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  // ─────────────────────────── پیش‌فرض ───────────────────────────
  describe('default home page', () => {
    it('is offered to the seller before anything is saved', async () => {
      const res = await seller(owner).get('/home').expect(200);
      expect(res.body).toMatchObject({ slug: 'home', isDefault: true, publishedAt: null, draftBlocks: null });
      expect(res.body.blocks.map((b: { type: string }) => b.type)).toEqual(['hero', 'product-grid']);
      expect(res.body.blocks[0].props.title).toBe(A.tenant.name);

      expect((await seller(owner).get('').expect(200)).body).toEqual([]);
      await seller(owner).get('/about').expect(404);
    });

    it('is what visitors see until a page is published', async () => {
      await prisma.tenant.update({
        where: { id: B.tenant.id },
        data: { settings: { description: 'توضیح فروشگاه B' } },
      });
      await redis.del(CACHE_PREFIX + subdomainHost(B));

      const res = await storefront(B, '/home').expect(200);
      expect(res.body).toMatchObject({ slug: 'home', title: B.tenant.name, publishedAt: null });
      expect(res.body.blocks[0]).toMatchObject({
        type: 'hero',
        props: { title: B.tenant.name, subtitle: 'توضیح فروشگاه B', ctaHref: '/products', image: null },
      });
      expect(res.body.blocks[1]).toMatchObject({ type: 'product-grid', props: { source: 'latest' } });
    });
  });

  // ─────────────────────────── پیش‌نویس ───────────────────────────
  describe('saving drafts', () => {
    it('keeps a new page hidden until it is published', async () => {
      const res = await seller(editor)
        .put('/about', { title: 'درباره‌ی ما', blocks: [text('سلام')] })
        .expect(200);

      expect(res.body).toMatchObject({
        slug: 'about',
        title: 'درباره‌ی ما',
        publishedAt: null,
        hasUnpublishedChanges: true,
        isDefault: false,
        blocks: [],
      });
      expect(res.body.draftBlocks).toHaveLength(1);

      expect((await seller(owner).get('').expect(200)).body.map((p: { slug: string }) => p.slug)).toContain('about');
      await storefront(A, '/about').expect(404);
    });

    it('normalizes blocks and generates missing ids', async () => {
      const res = await seller(owner)
        .put('/normalized', {
          title: 'نمونه',
          blocks: [
            { type: 'hero', props: { title: '  عنوان  ', subtitle: '' } },
            { type: 'product-grid', props: {} },
          ],
        })
        .expect(200);

      const [h, g] = res.body.draftBlocks;
      expect(h.id.length).toBeGreaterThan(0);
      expect(g.id).not.toBe(h.id);
      expect(h.props).toMatchObject({ title: 'عنوان', subtitle: null, align: 'center', imageId: null });
      expect(g.props).toMatchObject({ source: 'latest', limit: 8, columns: 4 });
    });

    it('rejects invalid blocks with readable messages', async () => {
      const res = await seller(owner).put('/bad', { title: 'بد', blocks: [hero({ title: '' })] }).expect(400);
      expect(res.body.message[0]).toContain('بلاک 1');

      for (const blocks of [
        [{ type: 'carousel', props: {} }],
        [hero({ ctaLabel: 'برو', ctaHref: 'javascript:alert(1)' })],
        [hero({ ctaLabel: 'برو', ctaHref: '//evil.com' })],
        [grid({ source: 'category' })],
        [grid({ limit: 100 })],
        [text('')],
        [text('a', 'dup'), text('b', 'dup')],
        Array.from({ length: 31 }, (_, i) => text('x', `b${i}`)),
      ]) {
        await seller(owner).put('/bad', { title: 'بد', blocks }).expect(400);
      }

      await seller(owner).put('/bad', { title: 'بد', blocks: 'nope' }).expect(400);
      await seller(owner).put('/bad', { title: 'بد' }).expect(400);
      await seller(owner).put('/bad', { title: 'بد', blocks: [], extra: 1 }).expect(400);
      expect(await prisma.page.count({ where: { tenantId: A.tenant.id, slug: 'bad' } })).toBe(0);
    });

    it('needs a title for a new page and validates the slug and title', async () => {
      await seller(owner).put('/untitled', { blocks: [text()] }).expect(400);
      await seller(owner).put('/x-page', { title: 'ا', blocks: [text()] }).expect(400);
      for (const slug of ['Bad_Slug', 'has space', '-start', 'end-', 'a--b']) {
        await seller(owner).put(`/${encodeURIComponent(slug)}`, { title: 'عنوان', blocks: [] }).expect(400);
      }
    });

    it('accepts only images that belong to the store', async () => {
      const own = await createMedia(A);
      const foreign = await createMedia(B);

      await seller(owner).put('/imgs', { title: 'تصویر', blocks: [hero({ imageId: foreign.id })] }).expect(400);
      await seller(owner)
        .put('/imgs', { title: 'تصویر', blocks: [hero({ imageId: '019a0000-0000-7000-8000-000000000000' })] })
        .expect(400);

      const ok = await seller(owner).put('/imgs', { title: 'تصویر', blocks: [hero({ imageId: own.id })] }).expect(200);
      expect(ok.body.images[own.id]).toMatchObject({ id: own.id, width: 1600 });
      expect(ok.body.images[own.id].urls.md).toContain(`/${A.tenant.id}/${own.id}/md.webp`);
    });
  });

  // ─────────────────────────── انتشار ───────────────────────────
  describe('publishing', () => {
    it('publishes the draft and serves resolved blocks to visitors', async () => {
      const media = await createMedia(A);
      await seller(owner)
        .put('/landing', {
          title: 'فرود',
          blocks: [
            hero({ imageId: media.id, subtitle: 'زیرعنوان', ctaLabel: 'خرید', ctaHref: '/products' }),
            text('# سلام\n\nمتن'),
            grid({ source: 'category', categorySlug: 'shoes', columns: 3 }),
          ],
        })
        .expect(200);

      const published = await seller(editor).post('/landing/publish').expect(200);
      expect(published.body).toMatchObject({ hasUnpublishedChanges: false, draftBlocks: null });
      expect(published.body.publishedAt).not.toBeNull();
      expect(published.body.blocks).toHaveLength(3);

      const res = await storefront(A, '/landing').expect(200);
      expect(res.body).toMatchObject({ slug: 'landing', title: 'فرود' });

      const [h, t, g] = res.body.blocks;
      expect(h.props).not.toHaveProperty('imageId');
      expect(h.props).toMatchObject({ title: 'عنوان اصلی', subtitle: 'زیرعنوان', ctaHref: '/products' });
      expect(h.props.image).toMatchObject({ id: media.id, alt: 'بنر' });
      expect(h.props.image.urls.lg).toContain(`/${A.tenant.id}/${media.id}/lg.webp`);
      expect(t).toMatchObject({ type: 'rich-text', props: { content: '# سلام\n\nمتن' } });
      expect(g).toMatchObject({ type: 'product-grid', props: { source: 'category', categorySlug: 'shoes', columns: 3 } });
    });

    it('does not show later edits until they are published, and can discard them', async () => {
      await seller(owner).put('/stable', { title: 'پایدار', blocks: [text('نسخه‌ی یک')] }).expect(200);
      await seller(owner).post('/stable/publish').expect(200);

      const edited = await seller(owner).put('/stable', { blocks: [text('نسخه‌ی دو')] }).expect(200);
      expect(edited.body).toMatchObject({ hasUnpublishedChanges: true });
      expect(edited.body.blocks[0].props.content).toBe('نسخه‌ی یک');
      expect(edited.body.draftBlocks[0].props.content).toBe('نسخه‌ی دو');
      expect((await storefront(A, '/stable').expect(200)).body.blocks[0].props.content).toBe('نسخه‌ی یک');

      const discarded = await seller(owner).del('/stable/draft').expect(200);
      expect(discarded.body).toMatchObject({ draftBlocks: null, hasUnpublishedChanges: false });

      await seller(owner).put('/stable', { blocks: [text('نسخه‌ی سه')] }).expect(200);
      await seller(owner).post('/stable/publish').expect(200);
      expect((await storefront(A, '/stable').expect(200)).body.blocks[0].props.content).toBe('نسخه‌ی سه');
    });

    it('refuses to publish when there is nothing new, nothing saved, or nothing in the page', async () => {
      await seller(owner).put('/once', { title: 'یک‌بار', blocks: [text()] }).expect(200);
      await seller(owner).post('/once/publish').expect(200);
      expect((await seller(owner).post('/once/publish').expect(409)).body.code).toBe('NOTHING_TO_PUBLISH');

      await seller(owner).post('/never-saved/publish').expect(404);

      await seller(owner).put('/blank', { title: 'خالی', blocks: [] }).expect(200);
      expect((await seller(owner).post('/blank/publish').expect(409)).body.code).toBe('EMPTY_PAGE');
      await storefront(A, '/blank').expect(404);
    });

    it('replaces the default home page once a home page is published', async () => {
      await seller(owner)
        .put('/home', { title: 'خانه', blocks: [hero({ title: 'صفحه‌ی اصلی من' }), text('درباره')] })
        .expect(200);
      expect((await storefront(A, '/home').expect(200)).body.blocks[0].props.title).toBe(A.tenant.name); // هنوز پیش‌فرض

      await seller(owner).post('/home/publish').expect(200);
      const res = await storefront(A, '/home').expect(200);
      expect(res.body.title).toBe('خانه');
      expect(res.body.blocks.map((b: { type: string }) => b.type)).toEqual(['hero', 'rich-text']);
      expect(res.body.blocks[0].props.title).toBe('صفحه‌ی اصلی من');
      expect((await seller(owner).get('/home').expect(200)).body.isDefault).toBe(false);
    });

    it('keeps working when an image is deleted afterwards', async () => {
      const media = await createMedia(A);
      await seller(owner).put('/gone', { title: 'تصویر حذف', blocks: [hero({ imageId: media.id })] }).expect(200);
      await seller(owner).post('/gone/publish').expect(200);
      await prisma.media.delete({ where: { id: media.id } });

      const res = await storefront(A, '/gone').expect(200);
      expect(res.body.blocks[0].props.image).toBeNull();
    });
  });

  // ─────────────────────────── حذف و دسترسی ───────────────────────────
  describe('deleting and permissions', () => {
    it('lets owners delete pages and editors work on them', async () => {
      await seller(editor).put('/temp', { title: 'موقت', blocks: [text()] }).expect(200);
      await seller(editor).post('/temp/publish').expect(200);
      await storefront(A, '/temp').expect(200);

      await seller(editor).del('/temp').expect(403);
      await seller(owner).del('/temp').expect(204);
      await storefront(A, '/temp').expect(404);
      await seller(owner).del('/temp').expect(404);
    });

    it('deleting the home page brings the default back', async () => {
      await seller(owner).del('/home').expect(204);
      const res = await storefront(A, '/home').expect(200);
      expect(res.body.blocks[0].props.title).toBe(A.tenant.name);
      expect((await seller(owner).get('/home').expect(200)).body.isDefault).toBe(true);
    });

    it('requires a seller token', async () => {
      await request(app.getHttpServer()).get('/api/pages').expect(401);
      await request(app.getHttpServer()).put('/api/pages/x').send({ title: 'xx', blocks: [] }).expect(401);
    });

    it('is isolated between stores', async () => {
      await seller(owner).put('/private', { title: 'خصوصی', blocks: [text('فقط A')] }).expect(200);
      await seller(owner).post('/private/publish').expect(200);

      await seller(ownerB).get('/private').expect(404);
      await seller(ownerB).post('/private/publish').expect(404);
      await seller(ownerB).del('/private').expect(404);
      expect((await seller(ownerB).get('').expect(200)).body).toEqual([]);

      await storefront(A, '/private').expect(200);
      await storefront(B, '/private').expect(404);
      expect((await storefront(B, '/home').expect(200)).body.blocks[0].props.title).toBe(B.tenant.name);
    });
  });

  // ─────────────────────────── ویترین و داده‌ی خراب ───────────────────────────
  describe('storefront resilience', () => {
    const plant = (slug: string, blocks: unknown) =>
      prisma.page.create({
        data: { tenantId: A.tenant.id, slug, title: 'دستی', blocks: blocks as never, publishedAt: new Date() },
      });

    it('serves only the valid blocks of a corrupted page', async () => {
      await plant('corrupt', [
        { type: 'evil', props: {} },
        42,
        null,
        { id: 'ok', type: 'rich-text', props: { content: 'سالم' } },
        { id: 'bad', type: 'hero', props: { title: 'x', ctaLabel: 'y', ctaHref: 'javascript:alert(1)' } },
      ]);

      const res = await storefront(A, '/corrupt').expect(200);
      expect(res.body.blocks.map((b: { id: string }) => b.id)).toEqual(['ok']);
    });

    it('returns an empty page when the stored blocks are not a list', async () => {
      await plant('weird', { not: 'a list' });
      expect((await storefront(A, '/weird').expect(200)).body.blocks).toEqual([]);
    });

    it('rejects malformed slugs', async () => {
      await storefront(A, '/Bad_Slug').expect(400);
      await storefront(A, '/has%20space').expect(400);
    });

    it('answers 404 without a store host', async () => {
      await request(app.getHttpServer()).get('/api/storefront/pages/home').expect(404);
    });
  });
});