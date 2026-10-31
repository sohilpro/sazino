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

describe('Store settings (theme)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let A: TenantFixture;
  let B: TenantFixture;
  let owner = '';
  let editor = '';
  let ownerB = '';

  const seller = (token: string) => ({
    get: () => request(app.getHttpServer()).get('/api/store-settings').set('Authorization', `Bearer ${token}`),
    put: (body: object) =>
      request(app.getHttpServer()).put('/api/store-settings').set('Authorization', `Bearer ${token}`).send(body),
  });
  const publicStore = (f: TenantFixture) =>
    request(app.getHttpServer()).get('/api/store').set('Host', subdomainHost(f));
  const createMedia = (f: TenantFixture) =>
    prisma.media.create({
      data: { tenantId: f.tenant.id, originalName: 'logo.png', mimeType: 'image/png', sizeBytes: 1, width: 200, height: 100, alt: 'لوگو' },
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

  it('returns defaults for a fresh store', async () => {
    const res = await seller(editor).get().expect(200);
    expect(res.body).toMatchObject({
      name: A.tenant.name,
      subdomain: A.tenant.subdomain,
      description: null,
      primaryColor: '#4f46e5',
      font: 'Vazirmatn FD',
      logo: null,
    });
    expect(res.body.storeUrl).toContain(A.tenant.subdomain);
    expect(res.body.storeUrl).not.toMatch(/\/$/);
  });

  it('updates everything and the storefront sees it immediately', async () => {
    const logo = await createMedia(A);
    await publicStore(A).expect(200); // کش Host گرم می‌شود

    const res = await seller(owner)
      .put({
        name: '  فروشگاه جدید  ',
        description: '  توضیح تازه  ',
        primaryColor: '#E11D48',
        font: 'noto-naskh-arabic',
        logoMediaId: logo.id,
      })
      .expect(200);

    expect(res.body).toMatchObject({
      name: 'فروشگاه جدید',
      description: 'توضیح تازه',
      primaryColor: '#e11d48',
      font: 'noto-naskh-arabic',
    });
    expect(res.body.logo).toMatchObject({ id: logo.id, alt: 'لوگو' });
    expect(res.body.logo.urls.sm).toContain(`/${A.tenant.id}/${logo.id}/sm.webp`);

    // کش Host پاک شده و ویترین مقدار تازه را می‌بیند
    expect(await redis.get(CACHE_PREFIX + subdomainHost(A))).toBeNull();
    const store = await publicStore(A).expect(200);
    expect(store.body).toMatchObject({
      name: 'فروشگاه جدید',
      description: 'توضیح تازه',
      theme: { primaryColor: '#e11d48', font: 'noto-naskh-arabic' },
    });
    expect(store.body.logoUrl).toContain(`/${logo.id}/sm.webp`);
  });

  it('keeps unrelated settings keys and untouched values', async () => {
    await prisma.tenant.update({
      where: { id: B.tenant.id },
      data: { settings: { currency: 'IRT', primaryColor: '#112233', font: 'noto-kufi-arabic' } },
    });

    await seller(ownerB).put({ description: 'فقط توضیح' }).expect(200);

    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: B.tenant.id } });
    expect(row.settings).toEqual({
      currency: 'IRT',
      primaryColor: '#112233',
      font: 'noto-kufi-arabic',
      description: 'فقط توضیح',
    });
  });

  it('clears the description and the logo with empty values', async () => {
    const logo = await createMedia(A);
    await seller(owner).put({ description: 'موقت', logoMediaId: logo.id }).expect(200);

    const res = await seller(owner).put({ description: '', logoMediaId: null }).expect(200);
    expect(res.body).toMatchObject({ description: null, logo: null });

    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: A.tenant.id } });
    expect(row.settings).not.toHaveProperty('description');
    expect(row.settings).not.toHaveProperty('logoMediaId');
  });

  it('validates every field', async () => {
    const foreign = await createMedia(B);
    for (const body of [
      { primaryColor: '#fff' },
      { primaryColor: 'red' },
      { primaryColor: 'red;} body{display:none' },
      { font: 'comic-sans' },
      { font: 'Vazirmatn FD; } body { display:none' },
      { name: 'ا' },
      { name: 'x'.repeat(61) },
      { description: 'x'.repeat(501) },
      { logoMediaId: 'not-a-uuid' },
      { logoMediaId: '019a0000-0000-7000-8000-000000000000' },
      { logoMediaId: foreign.id },
      { plan: 'PRO' },
    ]) {
      await seller(owner).put(body).expect(400);
    }
  });

  it('lets only owners and admins change it', async () => {
    await seller(editor).put({ primaryColor: '#000000' }).expect(403);
    await request(app.getHttpServer()).get('/api/store-settings').expect(401);
    await request(app.getHttpServer()).put('/api/store-settings').send({}).expect(401);
  });

  it('never leaks across stores', async () => {
    await seller(owner).put({ primaryColor: '#abcdef' }).expect(200);

    const b = await seller(ownerB).get().expect(200);
    expect(b.body.primaryColor).toBe('#112233');
    expect((await publicStore(B).expect(200)).body.theme.primaryColor).toBe('#112233');
  });

  it('does not touch the subdomain or plan', async () => {
    await seller(owner).put({ name: 'نام دیگر' }).expect(200);
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: A.tenant.id } });
    expect(row).toMatchObject({ subdomain: A.tenant.subdomain, plan: 'FREE', status: 'ACTIVE' });
  });
});