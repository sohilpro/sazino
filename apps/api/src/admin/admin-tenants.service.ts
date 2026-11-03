import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminStatsDto,
  AdminTenantDetailDto,
  AdminTenantSummaryDto,
  Paginated,
  TenantPlan,
  TenantStatus,
} from '@myapp/shared-types';
import { conflict } from '../common/errors';
import { buildMeta } from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { PLAN_KEYS } from '../plans/plan-defaults';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantResolver } from '../tenants/tenant-resolver';
import { TenantStatusService } from '../tenants/tenant-status.service';
import { AdminAuditService } from './admin-audit.service';
import type { AdminTenantListQueryDto } from './admin.dto';
import type { AdminActor } from './admin.guard';

const listInclude = {
  _count: { select: { products: true, orders: true, customers: true, domains: true } },
  users: {
    where: { role: 'OWNER' },
    select: { email: true },
    orderBy: { createdAt: 'asc' },
    take: 1,
  },
} as const satisfies Prisma.TenantInclude;

type TenantRow = Prisma.TenantGetPayload<{ include: typeof listInclude }>;

const toSummary = (t: TenantRow): AdminTenantSummaryDto => ({
  id: t.id,
  name: t.name,
  subdomain: t.subdomain,
  plan: t.plan,
  status: t.status,
  ownerEmail: t.users[0]?.email ?? null,
  productCount: t._count.products,
  orderCount: t._count.orders,
  customerCount: t._count.customers,
  domainCount: t._count.domains,
  createdAt: t.createdAt.toISOString(),
  suspendedAt: t.suspendedAt ? t.suspendedAt.toISOString() : null,
});

@Injectable()
export class AdminTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly audit: AdminAuditService,
    private readonly resolver: TenantResolver,
    private readonly status: TenantStatusService,
  ) {}

  // ───────────── خواندن ─────────────
  async stats(): Promise<AdminStatsDto> {
    const statuses: TenantStatus[] = ['ACTIVE', 'SUSPENDED'];
    const [byStatus, byPlan] = await Promise.all([
      Promise.all(statuses.map((status) => this.prisma.tenant.count({ where: { status } }))),
      Promise.all(PLAN_KEYS.map((plan) => this.prisma.tenant.count({ where: { plan } }))),
    ]);

    return {
      tenants: Object.fromEntries(statuses.map((s, i) => [s, byStatus[i]!])) as AdminStatsDto['tenants'],
      byPlan: Object.fromEntries(PLAN_KEYS.map((p, i) => [p, byPlan[i]!])) as AdminStatsDto['byPlan'],
    };
  }

  async list(q: AdminTenantListQueryDto): Promise<Paginated<AdminTenantSummaryDto>> {
    const term = q.q?.trim();
    const where: Prisma.TenantWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.plan ? { plan: q.plan } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { subdomain: { contains: term.toLowerCase() } },
              { users: { some: { email: { contains: term.toLowerCase() } } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: listInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { items: rows.map(toSummary), meta: buildMeta(q.page, q.limit, total) };
  }

  async get(id: string): Promise<AdminTenantDetailDto> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, include: listInclude });
    if (!tenant) throw new NotFoundException('فروشگاه پیدا نشد');

    const [planInfo, products, domainRows, media, staff, audit] = await Promise.all([
      this.plans.get(tenant.plan),
      this.prisma.product.count({ where: { tenantId: id } }),
      this.prisma.domain.findMany({
        where: { tenantId: id },
        select: { hostname: true, status: true, isPrimary: true },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.media.aggregate({ where: { tenantId: id }, _sum: { sizeBytes: true } }),
      this.prisma.user.findMany({
        where: { tenantId: id },
        select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.adminAuditLog.findMany({
        where: { targetTenantId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      ...toSummary(tenant),
      suspendedReason: tenant.suspendedReason,
      planInfo,
      usage: { products, domains: domainRows.length, mediaBytes: media._sum.sizeBytes ?? 0 },
      staff: staff.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null })),
      domains: domainRows,
      audit: audit.map((a) => ({
        id: a.id,
        adminEmail: a.adminEmail,
        action: a.action,
        details: (a.details ?? {}) as Record<string, unknown>,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  // ───────────── تغییر ─────────────
  async suspend(actor: AdminActor, id: string, reason: string): Promise<AdminTenantDetailDto> {
    await this.assertExists(id);

    const { count } = await this.prisma.tenant.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'SUSPENDED', suspendedAt: new Date(), suspendedReason: reason },
    });
    if (count !== 1) throw conflict('ALREADY_SUSPENDED', 'این فروشگاه از قبل تعلیق شده است');

    await this.afterStatusChange(id);
    await this.audit.record(actor, 'tenant.suspend', id, { reason });
    return this.get(id);
  }

  async activate(actor: AdminActor, id: string): Promise<AdminTenantDetailDto> {
    await this.assertExists(id);

    const { count } = await this.prisma.tenant.updateMany({
      where: { id, status: 'SUSPENDED' },
      data: { status: 'ACTIVE', suspendedAt: null, suspendedReason: null },
    });
    if (count !== 1) throw conflict('NOT_SUSPENDED', 'این فروشگاه تعلیق نشده است');

    await this.afterStatusChange(id);
    await this.audit.record(actor, 'tenant.activate', id);
    return this.get(id);
  }

  async setPlan(actor: AdminActor, id: string, plan: TenantPlan): Promise<AdminTenantDetailDto> {
    const tenant = await this.assertExists(id);
    if (tenant.plan === plan) return this.get(id); // بدون تغییر، بدون لاگ

    await this.prisma.tenant.update({ where: { id }, data: { plan } });
    await this.audit.record(actor, 'tenant.plan', id, { from: tenant.plan, to: plan });
    return this.get(id);
  }

  // ───────────── داخلی ─────────────
  private async assertExists(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true, plan: true } });
    if (!tenant) throw new NotFoundException('فروشگاه پیدا نشد');
    return tenant;
  }

  /** کش ویترین (Host) و کش وضعیت فروشنده هر دو باید فوراً پاک شوند */
  private async afterStatusChange(id: string): Promise<void> {
    await Promise.all([this.resolver.invalidateTenant(id), this.status.invalidate(id)]);
  }
}