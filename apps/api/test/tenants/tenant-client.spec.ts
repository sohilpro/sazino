import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTenantClient } from '../../src/tenants/tenant-client';
import { TenantContext } from '../../src/tenants/tenant-context';
import { cleanupFixtures, createFixture, RUN, type TenantFixture } from '../helpers/fixtures';

const base = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const ctx = new TenantContext();
const db = createTenantClient(base, ctx);

let A: TenantFixture;
let B: TenantFixture;

const asA = <T>(fn: () => PromiseLike<T> | T) => ctx.runAs(A.tenant.id, fn);
const asB = <T>(fn: () => PromiseLike<T> | T) => ctx.runAs(B.tenant.id, fn);

beforeAll(async () => {
  A = await createFixture(base, 'a');
  B = await createFixture(base, 'b');
});

afterAll(async () => {
  await cleanupFixtures(base, [A, B]);
  await base.$disconnect();
});

describe('reads never leak across tenants', () => {
  it('findMany returns only the current tenant users', async () => {
    const users = await asA(() => db.user.findMany());
    expect(users.map((u) => u.id).sort()).toEqual([A.owner.id, A.editor.id].sort());
  });

  it('count only counts the current tenant', async () => {
    expect(await asA(() => db.user.count())).toBe(2);
    expect(await asB(() => db.user.count())).toBe(2);
  });

  it('findUnique by id of another tenant returns null', async () => {
    expect(await asA(() => db.user.findUnique({ where: { id: B.owner.id } }))).toBeNull();
  });

  it('findUnique by email of another tenant returns null', async () => {
    const found = await asA(() => db.user.findUnique({ where: { email: B.owner.email } }));
    expect(found).toBeNull();
  });

  it('findFirst cannot reach another tenant', async () => {
    const found = await asA(() => db.user.findFirst({ where: { email: B.editor.email } }));
    expect(found).toBeNull();
  });

  it('an explicit tenantId filter for another tenant returns nothing', async () => {
    const users = await asA(() => db.user.findMany({ where: { tenantId: B.tenant.id } }));
    expect(users).toEqual([]);
  });

  it('OR conditions cannot bypass the tenant filter', async () => {
    const users = await asA(() =>
      db.user.findMany({
        where: { OR: [{ tenantId: B.tenant.id }, { id: A.owner.id }] },
      }),
    );
    expect(users.map((u) => u.id)).toEqual([A.owner.id]);
  });

  it('domains are scoped too', async () => {
    const domains = await asA(() => db.domain.findMany());
    expect(domains.map((d) => d.id)).toEqual([A.domain.id]);
  });
});

describe('writes never touch another tenant', () => {
  it('update on another tenant record fails and changes nothing', async () => {
    await expect(
      asA(() => db.user.update({ where: { id: B.owner.id }, data: { name: 'hacked' } })),
    ).rejects.toMatchObject({ code: 'P2025' });

    const after = await base.user.findUnique({ where: { id: B.owner.id } });
    expect(after?.name).toBe(B.owner.name);
  });

  it('updateMany affects zero rows of another tenant', async () => {
    const result = await asA(() =>
      db.user.updateMany({ where: { id: B.owner.id }, data: { name: 'hacked' } }),
    );
    expect(result.count).toBe(0);
    const after = await base.user.findUnique({ where: { id: B.owner.id } });
    expect(after?.name).toBe(B.owner.name);
  });

  it('delete on another tenant record fails and the record survives', async () => {
    await expect(asA(() => db.user.delete({ where: { id: B.editor.id } }))).rejects.toMatchObject({
      code: 'P2025',
    });
    expect(await base.user.findUnique({ where: { id: B.editor.id } })).not.toBeNull();
  });

  it('deleteMany affects zero rows of another tenant', async () => {
    const result = await asA(() => db.user.deleteMany({ where: { id: B.editor.id } }));
    expect(result.count).toBe(0);
    expect(await base.user.findUnique({ where: { id: B.editor.id } })).not.toBeNull();
  });

  it('upsert cannot overwrite a record of another tenant', async () => {
    // بسته به مسیر داخلی Prisma ممکن است خطا بدهد یا null برگرداند؛ مهم این است که رکورد B دست‌نخورده بماند
    await asA(() =>
      db.user.upsert({
        where: { email: B.owner.email },
        create: {
          tenantId: A.tenant.id,
          email: B.owner.email,
          name: 'x',
          passwordHash: 'x',
        },
        update: { name: 'hacked' },
      }),
    ).catch(() => undefined);

    const after = await base.user.findUnique({ where: { email: B.owner.email } });
    expect(after?.name).toBe(B.owner.name);
    expect(after?.tenantId).toBe(B.tenant.id);
  });

  it('upsert works on records of the current tenant', async () => {
    const result = await asA(() =>
      db.user.upsert({
        where: { id: A.editor.id },
        create: { email: `never-${RUN}@test.dev`, name: 'x', passwordHash: 'x' } as never,
        update: { name: A.editor.name },
      }),
    );
    expect(result.id).toBe(A.editor.id);
    expect(result.tenantId).toBe(A.tenant.id);
  });

  it('create with another tenantId is rejected', async () => {
    await expect(
      asA(() =>
        db.user.create({
          data: {
            tenantId: B.tenant.id,
            email: `evil-${RUN}@test.dev`,
            name: 'evil',
            passwordHash: 'x',
          },
        }),
      ),
    ).rejects.toThrow('Tenant scope violation');
  });

  it('create through the "tenant" relation is rejected', async () => {
    await expect(
      asA(() =>
        db.user.create({
          data: {
            tenant: { connect: { id: B.tenant.id } },
            email: `evil2-${RUN}@test.dev`,
            name: 'evil',
            passwordHash: 'x',
          },
        }),
      ),
    ).rejects.toThrow('Tenant scope violation');
  });

  it('update cannot move a record to another tenant', async () => {
    await expect(
      asA(() => db.user.update({ where: { id: A.editor.id }, data: { tenantId: B.tenant.id } })),
    ).rejects.toThrow('Tenant scope violation');
  });

  it('create injects the current tenantId when it is omitted (safety net)', async () => {
    const created = await asA(() =>
      db.user.create({
        data: { email: `auto-${RUN}@test.dev`, name: 'Auto', passwordHash: 'x' } as never,
      }),
    );
    expect(created.tenantId).toBe(A.tenant.id);
  });

  it('createMany injects the current tenantId', async () => {
    await asA(() =>
      db.user.createMany({
        data: [
          { email: `bulk1-${RUN}@test.dev`, name: 'Bulk 1', passwordHash: 'x' },
          { email: `bulk2-${RUN}@test.dev`, name: 'Bulk 2', passwordHash: 'x' },
        ] as never,
      }),
    );
    const bulk = await base.user.findMany({
      where: { email: { startsWith: 'bulk' }, name: { startsWith: 'Bulk' }, tenantId: A.tenant.id },
    });
    expect(bulk.filter((u) => u.email.endsWith(`-${RUN}@test.dev`))).toHaveLength(2);
  });
});

describe('root and system models', () => {
  it('tenant.findMany returns only the current tenant', async () => {
    const tenants = await asA(() => db.tenant.findMany());
    expect(tenants.map((t) => t.id)).toEqual([A.tenant.id]);
  });

  it('tenant.findUnique of another tenant returns null', async () => {
    expect(await asA(() => db.tenant.findUnique({ where: { id: B.tenant.id } }))).toBeNull();
  });

  it('tenant writes are blocked on the tenant client', async () => {
    await expect(asA(() => db.tenant.delete({ where: { id: A.tenant.id } }))).rejects.toThrow(
      'Tenant scope violation',
    );
    await expect(
      asA(() => db.tenant.update({ where: { id: A.tenant.id }, data: { plan: 'PRO' } })),
    ).rejects.toThrow('Tenant scope violation');
  });

  it('system-only models are blocked on the tenant client', async () => {
    await expect(asA(() => db.refreshToken.findMany())).rejects.toThrow('Tenant scope violation');
  });
});

describe('context handling', () => {
  it('fails closed when there is no tenant context', async () => {
    await expect((async () => db.user.findMany())()).rejects.toThrow('Tenant context is missing');
  });

  it('works inside interactive transactions', async () => {
    const users = await asA(() => db.$transaction(async (tx) => tx.user.findMany()));
    expect(users.every((u) => u.tenantId === A.tenant.id)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps contexts isolated under concurrency', async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        i % 2 ? asB(() => db.user.findMany()) : asA(() => db.user.findMany()),
      ),
    );
    results.forEach((users, i) => {
      const expected = i % 2 ? B : A;
      expect(users.length).toBeGreaterThanOrEqual(2);
      expect(users.every((u) => u.tenantId === expected.tenant.id)).toBe(true);
    });
  });
});
