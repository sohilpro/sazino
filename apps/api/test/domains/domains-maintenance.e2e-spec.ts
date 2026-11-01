import { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DNS_LOOKUP } from '../../src/domains/dns-lookup';
import { VERIFY_LABEL, VERIFY_PREFIX } from '../../src/domains/domain-verifier';
import { MaintenanceService } from '../../src/maintenance/maintenance.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { createTestApp } from '../helpers/create-app';
import { FakeDns } from '../helpers/fake-dns';
import { cleanupFixtures, createFixture, subdomainHost, type TenantFixture } from '../helpers/fixtures';

const DAY = 24 * 60 * 60 * 1000;
const RUN = randomUUID().slice(0, 6);
let counter = 0;
const uniqueHost = () => `m${++counter}-${RUN}.example.org`;
const ago = (ms: number) => new Date(Date.now() - ms);

describe('Domain maintenance', () => {
  const dns = new FakeDns();
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let maintenance: MaintenanceService;
  let A: TenantFixture;

  const storeAt = (host: string) => request(app.getHttpServer()).get('/api/store').set('Host', host);
  const tokenFor = (host: string) => `tok-${host}`;
  const setOwnership = (host: string) => dns.setTxt(`${VERIFY_LABEL}.${host}`, [`${VERIFY_PREFIX}${tokenFor(host)}`]);

  const createVerified = (host: string, extra: Record<string, unknown> = {}) =>
    prisma.domain.create({
      data: {
        tenantId: A.tenant.id,
        hostname: host,
        verifiedHostname: host,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verificationToken: tokenFor(host),
        ...extra,
      },
    });
  const reopen = (id: string) => prisma.domain.update({ where: { id }, data: { lastCheckedAt: ago(2 * DAY) } });
  const row = (id: string) => prisma.domain.findUniqueOrThrow({ where: { id } });
  const run = () => maintenance.revalidateDomains({ tenantId: A.tenant.id });

  beforeAll(async () => {
    app = await createTestApp((b) => b.overrideProvider(DNS_LOOKUP).useValue(dns));
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    maintenance = app.get(MaintenanceService);
    A = await createFixture(prisma, 'a');
  });

  beforeEach(() => dns.reset());

  afterAll(async () => {
    await redis.del(`tenant:host:${subdomainHost(A)}`);
    await cleanupFixtures(prisma, [A]);
    await app.close();
  });

  it('keeps a domain whose ownership record is still there and resets earlier failures', async () => {
    const host = uniqueHost();
    const d = await createVerified(host, { checkFailures: 2 });
    setOwnership(host);

    await run();
    expect(await row(d.id)).toMatchObject({ status: 'VERIFIED', checkFailures: 0 });
    expect((await row(d.id)).lastCheckedAt).not.toBeNull();
  });

  it('disables the domain after three failed daily checks and frees its name', async () => {
    const host = uniqueHost();
    const d = await createVerified(host, { isPrimary: true });
    await storeAt(host).expect(200); // کش گرم می‌شود

    for (const expected of [1, 2]) {
      await reopen(d.id);
      await run();
      expect(await row(d.id)).toMatchObject({ status: 'VERIFIED', checkFailures: expected });
    }

    await reopen(d.id);
    await run();
    expect(await row(d.id)).toMatchObject({
      status: 'FAILED',
      verifiedHostname: null,
      isPrimary: false,
      checkFailures: 3,
    });
    await storeAt(host).expect(404);

    // نام آزاد شده است: فروشگاه دیگری می‌تواند آن را تأیید کند
    const C = await createFixture(prisma, 'c');
    try {
      await expect(
        prisma.domain.create({
          data: {
            tenantId: C.tenant.id,
            hostname: host,
            verifiedHostname: host,
            status: 'VERIFIED',
            verificationToken: 'other',
          },
        }),
      ).resolves.toBeTruthy();
    } finally {
      await cleanupFixtures(prisma, [C]);
    }
  });

  it('promotes another verified domain when the primary one is disabled', async () => {
    const primaryHost = uniqueHost();
    const otherHost = uniqueHost();
    const primary = await createVerified(primaryHost, { isPrimary: true, checkFailures: 2, lastCheckedAt: ago(2 * DAY) });
    const other = await createVerified(otherHost, { lastCheckedAt: new Date() });

    await run();

    expect(await row(primary.id)).toMatchObject({ status: 'FAILED', isPrimary: false });
    expect((await row(other.id)).isPrimary).toBe(true);
  });

  it('does not count unreachable dns as a failure', async () => {
    const host = uniqueHost();
    const d = await createVerified(host, { checkFailures: 2 });
    dns.fail(`${VERIFY_LABEL}.${host}`);

    await run();
    expect(await row(d.id)).toMatchObject({ status: 'VERIFIED', checkFailures: 2 });
  });

  it('checks each domain at most once a day', async () => {
    const host = uniqueHost();
    await createVerified(host, { lastCheckedAt: new Date() });

    await run();
    expect(dns.queries.filter((q) => q.includes(host))).toEqual([]);
  });

  it('never touches domains that are not verified', async () => {
    const host = uniqueHost();
    const d = await prisma.domain.create({
      data: { tenantId: A.tenant.id, hostname: host, status: 'PENDING', verificationToken: tokenFor(host) },
    });
    await run();
    expect(await row(d.id)).toMatchObject({ status: 'PENDING', checkFailures: 0, lastCheckedAt: null });
  });

  it('cleanup removes stale pending domains only', async () => {
    const make = (status: 'PENDING' | 'FAILED', age: number) => {
      const host = uniqueHost();
      return prisma.domain.create({
        data: {
          tenantId: A.tenant.id,
          hostname: host,
          status,
          verificationToken: tokenFor(host),
          createdAt: ago(age),
        },
      });
    };
    const stalePending = await make('PENDING', 20 * DAY);
    const freshPending = await make('PENDING', 1 * DAY);
    const oldFailed = await make('FAILED', 40 * DAY);

    const result = await maintenance.cleanup();
    expect(result.pendingDomains).toBeGreaterThanOrEqual(1);

    expect(await prisma.domain.count({ where: { id: stalePending.id } })).toBe(0);
    expect(await prisma.domain.count({ where: { id: freshPending.id } })).toBe(1);
    expect(await prisma.domain.count({ where: { id: oldFailed.id } })).toBe(1);
  });
});