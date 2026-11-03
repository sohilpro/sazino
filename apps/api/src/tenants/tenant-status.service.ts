import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { TenantStatus } from '@myapp/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const TTL_SECONDS = 30;
const key = (tenantId: string) => `tenant:status:${tenantId}`;

/**
 * وضعیت فروشگاه با کش کوتاه؛ هر درخواست فروشنده (JwtAuthGuard) از این می‌پرسد.
 * تغییر وضعیت (تعلیق یا فعال‌سازی) کش را صریحاً پاک می‌کند، پس اثرش فوری است.
 */
@Injectable()
export class TenantStatusService {
  private readonly logger = new Logger(TenantStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** null = فروشگاهی با این شناسه نیست */
  async get(tenantId: string): Promise<TenantStatus | null> {
    try {
      const cached = await this.redis.get(key(tenantId));
      if (cached === 'ACTIVE' || cached === 'SUSPENDED') return cached;
    } catch (err) {
      this.logger.warn(`Status cache read failed: ${(err as Error).message}`);
    }

    const row = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
    if (!row) return null;

    try {
      await this.redis.set(key(tenantId), row.status, 'EX', TTL_SECONDS);
    } catch (err) {
      this.logger.warn(`Status cache write failed: ${(err as Error).message}`);
    }
    return row.status;
  }

  async invalidate(tenantId: string): Promise<void> {
    try {
      await this.redis.del(key(tenantId));
    } catch (err) {
      this.logger.warn(`Status cache invalidation failed: ${(err as Error).message}`);
    }
  }
}