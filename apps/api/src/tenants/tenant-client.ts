/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from '../generated/prisma/client';
import type { TenantContext } from './tenant-context';
import { classifyModel, TenantScopeError } from './tenant-scope';

type Args = Record<string, any>;

/** فیلتر چندرکوردی: where کاربر داخل AND می‌رود تا با OR/NOT قابل دورزدن نباشد */
function andFilter(where: Args | undefined, field: string, value: string): Args {
  return { AND: [where ?? {}, { [field]: value }] };
}

/** فیلتر تک‌رکوردی (where یکتا): فیلد tenant کنار کلید یکتا اضافه می‌شود */
function toArray(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** فیلتر تک‌رکوردی (where یکتا): فیلد tenant کنار کلید یکتا اضافه می‌شود */
function uniqueFilter(where: Args | undefined, field: string, value: string): Args {
  if (!where) throw new TenantScopeError('a unique "where" is required');

  const existing = where[field];
  if (existing !== undefined && existing !== value) {
    // کاربر صراحتاً فیلد tenant دیگری را داده؛ به‌جای خطا، شرطی اضافه می‌کنیم که هیچ رکوردی
    // را پیدا نکند (نتیجه: null یا P2025، هم‌رفتار با درخواست tenant ناموجود)
    return { ...where, AND: [...toArray(where.AND), { [field]: value }] };
  }
  return { ...where, [field]: value };
}

function guardCreate(data: Args | undefined, tenantId: string): Args {
  if (!data) throw new TenantScopeError('"data" is required');
  if (data.tenant !== undefined) {
    throw new TenantScopeError('use "tenantId" instead of the "tenant" relation');
  }
  if (data.tenantId !== undefined && data.tenantId !== tenantId) {
    throw new TenantScopeError('writing to another tenant is not allowed');
  }
  return { ...data, tenantId };
}

function guardUpdate(data: Args | undefined, tenantId: string): Args | undefined {
  if (!data) return data;
  if (data.tenant !== undefined) {
    throw new TenantScopeError('changing the "tenant" relation is not allowed');
  }
  if (data.tenantId !== undefined) {
    const next =
      typeof data.tenantId === 'object' && data.tenantId !== null
        ? data.tenantId.set
        : data.tenantId;
    if (next !== tenantId) {
      throw new TenantScopeError('moving records between tenants is not allowed');
    }
  }
  return data;
}

function scopeScoped(model: string, operation: string, args: Args | undefined, tenantId: string) {
  const a: Args = { ...(args ?? {}) };

  switch (operation) {
    case 'findMany':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'count':
    case 'aggregate':
    case 'groupBy':
    case 'deleteMany':
      a.where = andFilter(a.where, 'tenantId', tenantId);
      return a;

    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'delete':
      a.where = uniqueFilter(a.where, 'tenantId', tenantId);
      return a;

    case 'update':
      a.where = uniqueFilter(a.where, 'tenantId', tenantId);
      a.data = guardUpdate(a.data, tenantId);
      return a;

    case 'updateMany':
    case 'updateManyAndReturn':
      a.where = andFilter(a.where, 'tenantId', tenantId);
      a.data = guardUpdate(a.data, tenantId);
      return a;

    case 'create':
      a.data = guardCreate(a.data, tenantId);
      return a;

    case 'createMany':
    case 'createManyAndReturn':
      a.data = Array.isArray(a.data)
        ? a.data.map((d: Args) => guardCreate(d, tenantId))
        : guardCreate(a.data, tenantId);
      return a;

    case 'upsert':
      a.where = uniqueFilter(a.where, 'tenantId', tenantId);
      a.create = guardCreate(a.create, tenantId);
      a.update = guardUpdate(a.update, tenantId);
      return a;

    default:
      throw new TenantScopeError(
        `operation "${operation}" on "${model}" is not allowed on the tenant client`,
      );
  }
}

/** مدل ریشه (Tenant): فقط خواندنِ رکورد خودِ tenant */
function scopeRoot(model: string, operation: string, args: Args | undefined, tenantId: string) {
  const a: Args = { ...(args ?? {}) };

  switch (operation) {
    case 'findMany':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'count':
    case 'aggregate':
    case 'groupBy':
      a.where = andFilter(a.where, 'id', tenantId);
      return a;

    case 'findUnique':
    case 'findUniqueOrThrow':
      a.where = uniqueFilter(a.where, 'id', tenantId);
      return a;

    default:
      throw new TenantScopeError(
        `"${operation}" on "${model}" is system-only; use PrismaService with an explicit id`,
      );
  }
}

export function createTenantClient(base: PrismaClient, ctx: TenantContext) {
  return base.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = ctx.require();
          const kind = classifyModel(model);

          let scoped: Args;
          if (kind === 'scoped') {
            scoped = scopeScoped(model, operation, args as Args | undefined, tenantId);
          } else if (kind === 'root') {
            scoped = scopeRoot(model, operation, args as Args | undefined, tenantId);
          } else {
            throw new TenantScopeError(
              `model "${model}" is not available on the tenant client (use PrismaService)`,
            );
          }

          return query(scoped as typeof args);
        },
      },
    },
  });
}
