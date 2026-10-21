import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { CACHE_PREFIX, NEGATIVE_MARKER, TenantResolver } from '../../src/tenants/tenant-resolver';
import {
  cleanupFixtures,
  createFixture,
  PLATFORM_DOMAIN,
  RUN,
  subdomainHost,
  type TenantFixture,
} from '../helpers/fixtures';

describe('Multi-tenancy over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let redis: Redis;
  let resolver: TenantResolver;

  let A: TenantFixture;
  let B: TenantFixture;
  const created: TenantFixture[] = [];
  const touchedHosts = new Set<string>();

  const get = (path: string, host?: string) => {
    const req = request(app.getHttpServer()).get(path);
    if (host) {
      touchedHosts.add(host);
      req.set('Host', host);
    }
    return req;
  };

  const tokenFor = (u: { id: string; tenantId: string; role: string }) =>
    jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });

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
    redis = app.get<Redis>(REDIS_CLIENT);
    resolver = app.get(TenantResolver);

    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');
    created.push(A, B);
  });

  afterAll(async () => {
    await redis.del(...[...touchedHosts].map((h) => CACHE_PREFIX + h));
    await cleanupFixtures(prisma, created);
    await app.close();
  });

  describe('host resolution', () => {
    it('resolves a store from its subdomain', async () => {
      const res = await get('/api/store', subdomainHost(A)).expect(200);
      expect(res.body).toMatchObject({ id: A.tenant.id, name: A.tenant.name });
    });

    it('resolves a different store from a different subdomain', async () => {
      const res = await get('/api/store', subdomainHost(B)).expect(200);
      expect(res.body).toMatchObject({ id: B.tenant.id, name: B.tenant.name });
    });

    it('returns 404 for an unknown subdomain', async () => {
      await get('/api/store', `nope${RUN}.${PLATFORM_DOMAIN}`).expect(404);
    });

    it('returns 404 on platform hosts (no store)', async () => {
      await get('/api/store', PLATFORM_DOMAIN).expect(404);
      await get('/api/store', `api.${PLATFORM_DOMAIN}`).expect(404);
      await get('/api/store').expect(404); // Host = 127.0.0.1
    });

    it('resolves from the x-tenant-host header (Nuxt SSR)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/store')
        .set('X-Tenant-Host', subdomainHost(A))
        .expect(200);
      expect(res.body.id).toBe(A.tenant.id);
      touchedHosts.add(subdomainHost(A));
    });

    it('rejects an unknown host sent via x-tenant-host', async () => {
      await request(app.getHttpServer())
        .get('/api/store')
        .set('X-Tenant-Host', 'unknown-host.example.org')
        .expect(404);
    });

    it('resolves a VERIFIED custom domain', async () => {
      const res = await get('/api/store', A.domain.hostname).expect(200);
      expect(res.body.id).toBe(A.tenant.id);
    });

    it('does not resolve a PENDING custom domain', async () => {
      const hostname = `pending${RUN}.example.test`;
      await prisma.domain.create({
        data: {
          tenantId: A.tenant.id,
          hostname,
          status: 'PENDING',
          verificationToken: randomUUID(),
        },
      });
      touchedHosts.add(hostname);

      await get('/api/store', hostname).expect(404);
      await request(app.getHttpServer())
        .get('/api/store')
        .set('X-Tenant-Host', hostname)
        .expect(404);
    });

    it('returns 403 for a suspended store', async () => {
      const C = await createFixture(prisma, 'c');
      created.push(C);
      await prisma.tenant.update({ where: { id: C.tenant.id }, data: { status: 'SUSPENDED' } });
      await get('/api/store', subdomainHost(C)).expect(403);
    });
  });

  describe('Redis cache', () => {
    it('caches positive lookups with a TTL', async () => {
      const host = subdomainHost(A);
      await get('/api/store', host).expect(200);
      const raw = await redis.get(CACHE_PREFIX + host);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw as string).id).toBe(A.tenant.id);
      const ttl = await redis.ttl(CACHE_PREFIX + host);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('caches unknown hosts (negative cache)', async () => {
      const host = `ghost${RUN}.${PLATFORM_DOMAIN}`;
      await get('/api/store', host).expect(404);
      expect(await redis.get(CACHE_PREFIX + host)).toBe(NEGATIVE_MARKER);
    });

    it('serves stale data from cache until it is invalidated', async () => {
      const D = await createFixture(prisma, 'd');
      created.push(D);
      const host = subdomainHost(D);

      const first = await get('/api/store', host).expect(200);
      expect(first.body.name).toBe(D.tenant.name);

      await prisma.tenant.update({ where: { id: D.tenant.id }, data: { name: 'Renamed' } });

      const cached = await get('/api/store', host).expect(200);
      expect(cached.body.name).toBe(D.tenant.name); // هنوز از کش

      await resolver.invalidateTenant(D.tenant.id);

      const fresh = await get('/api/store', host).expect(200);
      expect(fresh.body.name).toBe('Renamed');
    });
  });

  describe('authenticated isolation', () => {
    it('lists only the members of the token tenant (A)', async () => {
      const token = await tokenFor(A.owner);
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const emails = (res.body as Array<{ email: string }>).map((u) => u.email).sort();
      expect(emails).toEqual([A.owner.email, A.editor.email].sort());
    });

    it('lists only the members of the token tenant (B)', async () => {
      const token = await tokenFor(B.owner);
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const emails = (res.body as Array<{ email: string }>).map((u) => u.email).sort();
      expect(emails).toEqual([B.owner.email, B.editor.email].sort());
    });

    it('does not expose password hashes', async () => {
      const token = await tokenFor(A.owner);
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('forbids an EDITOR from listing users', async () => {
      const token = await tokenFor(A.editor);
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejects a token used on another store host', async () => {
      const token = await tokenFor(A.owner);
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Host', subdomainHost(B))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      touchedHosts.add(subdomainHost(B));
    });

    it('accepts a token on the host of its own store', async () => {
      const token = await tokenFor(A.owner);
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Host', subdomainHost(A))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('requires a token', async () => {
      await request(app.getHttpServer()).get('/api/users').expect(401);
    });
  });
});