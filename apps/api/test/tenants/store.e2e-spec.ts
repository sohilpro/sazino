import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { CACHE_PREFIX } from '../../src/tenants/tenant-resolver';
import type { Prisma } from '../../src/generated/prisma/client';
import {
  cleanupFixtures,
  createFixture,
  subdomainHost,
  type TenantFixture,
} from '../helpers/fixtures';

describe('Store info (branding)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let A: TenantFixture;
  let B: TenantFixture;
  const hosts = new Set<string>();

  const getStore = (f: TenantFixture) => {
    const host = subdomainHost(f);
    hosts.add(host);
    return request(app.getHttpServer()).get('/api/store').set('Host', host);
  };

  const setSettings = (f: TenantFixture, settings: Prisma.InputJsonObject) =>
    prisma.tenant.update({ where: { id: f.tenant.id }, data: { settings } });

  const createMedia = (f: TenantFixture) =>
    prisma.media.create({
      data: {
        tenantId: f.tenant.id,
        originalName: 'logo.png',
        mimeType: 'image/png',
        sizeBytes: 1,
        width: 10,
        height: 10,
      },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');
  });

  afterAll(async () => {
    if (hosts.size) await redis.del(...[...hosts].map((h) => CACHE_PREFIX + h));
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  it('returns defaults when the store has no settings', async () => {
    const res = await getStore(A).expect(200);
    expect(res.body).toMatchObject({
      id: A.tenant.id,
      name: A.tenant.name,
      description: null,
      logoUrl: null,
      theme: { primaryColor: '#4f46e5' },
    });
  });

  it('returns the configured color and description', async () => {
    await setSettings(A, { primaryColor: '#E11D48', description: '  توضیح فروشگاه  ' });
    const res = await getStore(A).expect(200);
    expect(res.body.theme.primaryColor).toBe('#e11d48');
    expect(res.body.description).toBe('توضیح فروشگاه');
  });

  it('falls back to the default color for unsafe values', async () => {
    await setSettings(A, { primaryColor: 'red;} body{display:none' });
    const res = await getStore(A).expect(200);
    expect(res.body.theme.primaryColor).toBe('#4f46e5');
  });

  it('returns the logo url of an own media item', async () => {
    const media = await createMedia(A);
    await setSettings(A, { logoMediaId: media.id });
    const res = await getStore(A).expect(200);
    expect(res.body.logoUrl).toContain(`/${A.tenant.id}/${media.id}/sm.webp`);
  });

  it('ignores a logo that belongs to another store', async () => {
    const foreign = await createMedia(B);
    await setSettings(A, { logoMediaId: foreign.id });
    const res = await getStore(A).expect(200);
    expect(res.body.logoUrl).toBeNull();
  });

  it('ignores a logo id that does not exist', async () => {
    await setSettings(A, { logoMediaId: '019a0000-0000-7000-8000-000000000000' });
    const res = await getStore(A).expect(200);
    expect(res.body.logoUrl).toBeNull();
  });

  it('does not expose internal fields', async () => {
    const res = await getStore(B).expect(200);
    for (const key of ['settings', 'plan', 'status', 'createdAt']) {
      expect(res.body).not.toHaveProperty(key);
    }
  });
});
