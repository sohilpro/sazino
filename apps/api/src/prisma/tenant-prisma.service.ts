import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

/**
 * کلاینت پایه‌ی TENANT_DB. اگر TENANT_DATABASE_URL تنظیم شده باشد با نقشی وصل می‌شود که
 * BYPASSRLS ندارد و Row Level Security روی همه‌ی کوئری‌هایش اعمال می‌شود؛
 * در غیر این صورت (توسعه‌ی ساده) با همان DATABASE_URL وصل می‌شود و فقط فیلتر سطح برنامه می‌ماند.
 *
 * فقط برای ساختن کلاینت tenant (createTenantClient) است؛ هیچ سرویسی مستقیم آن را تزریق نمی‌کند.
 */
@Injectable()
export class TenantPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TenantPrismaService.name);
  /** true یعنی نقش جداگانه‌ی بدون BYPASSRLS در کار است */
  readonly rls: boolean;

  constructor(config: ConfigService<Env, true>) {
    const tenantUrl = config.get('TENANT_DATABASE_URL', { infer: true });
    super({
      adapter: new PrismaPg({
        connectionString: tenantUrl ?? config.get('DATABASE_URL', { infer: true }),
      }),
    });
    this.rls = Boolean(tenantUrl);
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(
      this.rls
        ? 'Tenant client connected (row level security enforced)'
        : 'Tenant client connected (application-level isolation only; set TENANT_DATABASE_URL for RLS)',
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}