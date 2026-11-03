import { Injectable, NotFoundException } from '@nestjs/common';
import type { PlanDto, PlanUsage, PlanUsageDto } from '@myapp/shared-types';
import { conflict } from '../common/errors';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { planLimitMessage, type PlanResource } from './plan-limit-message';
import { PlansService } from './plans.service';

export type CountedResource = 'products' | 'domains';

const MB = 1024 * 1024;

export function limitOf(plan: PlanDto, resource: PlanResource): number | null {
  switch (resource) {
    case 'products':
      return plan.maxProducts;
    case 'domains':
      return plan.maxDomains;
    case 'media':
      return plan.maxMediaMb;
  }
}

@Injectable()
export class PlanLimitsService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly plans: PlansService,
  ) {}

  /** پلن فروشگاه فعلی؛ همیشه از دیتابیس (تغییر پلن بی‌درنگ اثر می‌کند) */
  async currentPlan(): Promise<PlanDto> {
    const tenant = await this.db.tenant.findUnique({
      where: { id: this.ctx.require() },
      select: { plan: true },
    });
    if (!tenant) throw new NotFoundException('فروشگاه پیدا نشد');
    return this.plans.get(tenant.plan);
  }

  async limitFor(resource: PlanResource): Promise<number | null> {
    return limitOf(await this.currentPlan(), resource);
  }

  async usage(): Promise<PlanUsage> {
    const [products, domains, media] = await Promise.all([
      this.db.product.count(),
      this.db.domain.count(),
      this.db.media.aggregate({ _sum: { sizeBytes: true } }),
    ]);
    return { products, domains, mediaBytes: media._sum.sizeBytes ?? 0 };
  }

  async snapshot(): Promise<PlanUsageDto> {
    const [plan, usage] = await Promise.all([this.currentPlan(), this.usage()]);
    return { plan, usage };
  }

  /** ساخت یک مورد جدید مجاز است؟ (سقف null = نامحدود). موجودهای قبلی هرگز تأثیر نمی‌گیرند. */
  async assertCanCreate(resource: CountedResource): Promise<void> {
    const plan = await this.currentPlan();
    const limit = limitOf(plan, resource);
    if (limit === null) return;

    const used = resource === 'products' ? await this.db.product.count() : await this.db.domain.count();
    if (used >= limit) {
      throw conflict('PLAN_LIMIT', planLimitMessage(resource, plan.name, limit), { resource, limit, used });
    }
  }

  /** آپلود تصویر جدید با این حجم در سقف فضای پلن می‌گنجد؟ */
  async assertMediaQuota(newBytes: number): Promise<void> {
    const plan = await this.currentPlan();
    const limit = plan.maxMediaMb;
    if (limit === null) return;

    const { mediaBytes } = await this.usage();
    if (mediaBytes + newBytes > limit * MB) {
      throw conflict('PLAN_LIMIT', planLimitMessage('media', plan.name, limit), {
        resource: 'media',
        limit,
        used: Math.ceil(mediaBytes / MB),
      });
    }
  }
}