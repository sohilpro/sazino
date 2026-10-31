import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PreviewTokenService } from '../../src/pages/preview-token.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import { createTestApp } from '../helpers/create-app';
import { cleanupFixtures, createFixture, subdomainHost, type TenantFixture } from '../helpers/fixtures';

const text = (content: string, id = 'text') => ({ id, type: 'rich-text', props: { content } });

describe('Page preview', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let tokens: PreviewTokenService;
  let A: TenantFixture;
  let B: TenantFixture;
  let owner = '';
  let editor = '';

  const seller = (token: string) => ({
    put: (slug: string, body: object) =>
      request(app.getHttpServer()).put(`/api/pages/${slug}`).set('Authorization', `Bearer ${token}`).send(body),
    post: (path: string) =>
      request(app.getHttpServer()).post(`/api/pages${path}`).set('Authorization', `Bearer ${token}`),
  });
  const visit = (f: TenantFixture, slug: string, preview?: string) => {
    const req = request(app.getHttpServer()).get(`/api/storefront/pages/${slug}`).set('Host', subdomainHost(f));
    return preview === undefined ? req : req.query({ preview });
  };
  const tokenOf = (url: string) => new URL(url).searchParams.get('preview')!;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    tokens = app.get(PreviewTokenService);
    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');

    const jwt = app.get(JwtService, { strict: false });
    const sign = (u: { id: string; tenantId: string; role: string }) =>
      jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });
    owner = await sign(A.owner);
    editor = await sign(A.editor);
  });

  afterAll(async () => {
    await redis.del(CACHE_PREFIX + subdomainHost(A), CACHE_PREFIX + subdomainHost(B));
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  it('shows an unpublished draft only through a preview link', async () => {
    await seller(owner).put('/secret', { title: 'محرمانه', blocks: [text('فقط پیش‌نویس')] }).expect(200);

    const res = await seller(editor).post('/secret/preview').expect(200);
    expect(res.body.url).toContain(A.tenant.subdomain);
    expect(res.body.url).toContain('/p/secret?preview=');
    const minutes = (new Date(res.body.expiresAt).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThanOrEqual(30);

    await visit(A, 'secret').expect(404); // بازدیدکننده‌ی عادی

    const previewed = await visit(A, 'secret', tokenOf(res.body.url)).expect(200);
    expect(previewed.body).toMatchObject({ slug: 'secret', title: 'محرمانه', preview: true, publishedAt: null });
    expect(previewed.body.blocks[0].props.content).toBe('فقط پیش‌نویس');
    expect(previewed.headers['cache-control']).toBe('no-store');
    expect(previewed.headers['x-robots-tag']).toContain('noindex');
  });

  it('shows the draft in preview and the published version to everyone else', async () => {
    await seller(owner).put('/live', { title: 'زنده', blocks: [text('نسخه‌ی منتشرشده')] }).expect(200);
    await seller(owner).post('/live/publish').expect(200);
    await seller(owner).put('/live', { blocks: [text('نسخه‌ی پیش‌نویس')] }).expect(200);

    const { body } = await seller(owner).post('/live/preview').expect(200);

    const previewed = await visit(A, 'live', tokenOf(body.url)).expect(200);
    expect(previewed.body.blocks[0].props.content).toBe('نسخه‌ی پیش‌نویس');
    expect(previewed.body.preview).toBe(true);

    const normal = await visit(A, 'live').expect(200);
    expect(normal.body.blocks[0].props.content).toBe('نسخه‌ی منتشرشده');
    expect(normal.body.preview).toBe(false);
    expect(normal.headers['cache-control']).not.toBe('no-store');
  });

  it('falls back to the published version when there is no draft', async () => {
    await seller(owner).put('/nodraft', { title: 'بی‌پیش‌نویس', blocks: [text('منتشر')] }).expect(200);
    await seller(owner).post('/nodraft/publish').expect(200);

    const { body } = await seller(owner).post('/nodraft/preview').expect(200);
    const res = await visit(A, 'nodraft', tokenOf(body.url)).expect(200);
    expect(res.body.blocks[0].props.content).toBe('منتشر');
  });

  it('previews the default home page too', async () => {
    const { body } = await seller(owner).post('/home/preview').expect(200);
    expect(new URL(body.url).pathname).toBe('/');

    const res = await visit(A, 'home', tokenOf(body.url)).expect(200);
    expect(res.body).toMatchObject({ slug: 'home', preview: true });
    expect(res.body.blocks[0].props.title).toBe(A.tenant.name);
  });

  it('refuses invalid, expired, foreign or misdirected tokens with 410', async () => {
    await seller(owner).put('/guarded', { title: 'محافظت‌شده', blocks: [text('x')] }).expect(200);
    await seller(owner).put('/other', { title: 'دیگر', blocks: [text('y')] }).expect(200);

    const valid = tokenOf((await seller(owner).post('/guarded/preview').expect(200)).body.url);
    const expired = tokens.sign(A.tenant.id, 'guarded', -1000).token;
    const otherTenant = tokens.sign(B.tenant.id, 'guarded').token;

    await visit(A, 'guarded', valid).expect(200);
    for (const token of ['garbage', '', `${valid}x`, expired, otherTenant]) {
      await visit(A, 'guarded', token).expect(410);
    }
    // توکن یک صفحه برای صفحه‌ی دیگر کار نمی‌کند
    await visit(A, 'other', valid).expect(410);
    // و روی فروشگاه دیگر هم نه
    await visit(B, 'guarded', valid).expect(410);
  });

  it('cannot preview a page that was never saved', async () => {
    await seller(owner).post('/not-saved/preview').expect(404);
    await request(app.getHttpServer()).post('/api/pages/home/preview').expect(401);
  });
});