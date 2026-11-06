import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { TenantContext } from '../tenants/tenant-context';
import { RATE_LIMIT_OPTIONS, type RateLimitOptions } from './rate-limit.options';

export const RATE_WINDOW_MS = 60_000;

/** همه‌ی مسیرهای ویترین (خواندن و نوشتن) */
export function isRateLimitedPath(path: string): boolean {
  return path === '/api/store' || path.startsWith('/api/storefront/');
}

export const ipBucketKey = (tenant: string, ip: string, window: number) =>
  `rl:ip:${tenant}:${ip}:${window}`;
export const tenantBucketKey = (tenant: string, window: number) => `rl:t:${tenant}:${window}`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(RATE_LIMIT_OPTIONS) private readonly options: RateLimitOptions,
    private readonly ctx: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.options.enabled || context.getType() !== 'http') return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    if (!isRateLimitedPath(req.path)) return true;

    const tenantId = this.ctx.tenantId ?? null;
    const now = Date.now();
    const window = Math.floor(now / RATE_WINDOW_MS);

    const checks = [
      {
        key: ipBucketKey(tenantId ?? 'none', req.ip ?? 'unknown', window),
        limit: this.options.ipPerMin,
      },
    ];
    if (tenantId) {
      checks.push({ key: tenantBucketKey(tenantId, window), limit: this.options.tenantPerMin });
    }

    let counts: number[];
    try {
      counts = await this.hit(checks.map((c) => c.key));
    } catch (e) {
      this.logger.warn(`Rate limit check failed: ${e instanceof Error ? e.message : String(e)}`);
      return true; // fail-open
    }

    if (!checks.some((c, i) => (counts[i] ?? 0) > c.limit)) return true;

    const retryAfter = Math.max(1, Math.ceil(((window + 1) * RATE_WINDOW_MS - now) / 1000));
    http.getResponse<Response>().setHeader('Retry-After', String(retryAfter));
    throw new HttpException(
      {
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید',
      },
      429,
    );
  }

  private async hit(keys: string[]): Promise<number[]> {
    const multi = this.redis.multi();
    for (const key of keys) multi.incr(key).expire(key, 120);
    const results = await multi.exec();
    if (!results) throw new Error('transaction aborted');
    return keys.map((_, i) => {
      const [err, value] = results[i * 2] ?? [null, 0];
      if (err) throw err;
      return Number(value);
    });
  }
}