import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { PlanDto, TenantPlan } from '@myapp/shared-types';
import type { Plan } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PLANS, isPlanKey, type PlanDefaults } from './plan-defaults';
import type { UpdatePlanDto } from './plan.dto';

const toDto = (p: Pick<Plan, 'key' | 'name' | 'maxProducts' | 'maxDomains' | 'maxMediaMb' | 'priceMonthly' | 'sortOrder'>): PlanDto => ({
  key: p.key as TenantPlan,
  name: p.name,
  maxProducts: p.maxProducts,
  maxDomains: p.maxDomains,
  maxMediaMb: p.maxMediaMb,
  priceMonthly: p.priceMonthly,
  sortOrder: p.sortOrder,
});

@Injectable()
export class PlansService implements OnModuleInit {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureDefaults();
    } catch (err) {
      // نبودن دیتابیس نباید بالا آمدن را بخواباند؛ get() خودش به مقدار پیش‌فرض برمی‌گردد
      this.logger.error(`Could not seed default plans: ${(err as Error).message}`);
    }
  }

  /** فقط ردیف‌های ناموجود را می‌سازد؛ ویرایش‌های سوپر ادمین را هرگز بازنویسی نمی‌کند */
  async ensureDefaults(): Promise<void> {
    await this.prisma.plan.createMany({
      data: DEFAULT_PLANS.map((p) => ({ ...p })),
      skipDuplicates: true,
    });
  }

  async list(): Promise<PlanDto[]> {
    const rows = await this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    // هر پلنی که ردیف ندارد با مقدار پیش‌فرض نشان داده می‌شود
    return DEFAULT_PLANS.map((d) => toDto(byKey.get(d.key) ?? d)).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async get(key: string): Promise<PlanDto> {
    if (!isPlanKey(key)) throw new NotFoundException('پلن پیدا نشد');
    const row = await this.prisma.plan.findUnique({ where: { key } });
    return toDto(row ?? (DEFAULT_PLANS.find((d) => d.key === key) as PlanDefaults));
  }

  async update(key: TenantPlan, dto: UpdatePlanDto): Promise<PlanDto> {
    await this.ensureDefaults();
    const row = await this.prisma.plan.update({
      where: { key },
      data: {
        name: dto.name,
        maxProducts: dto.maxProducts,
        maxDomains: dto.maxDomains,
        maxMediaMb: dto.maxMediaMb,
        priceMonthly: dto.priceMonthly ?? undefined
      },
    });
    return toDto(row);
  }
}