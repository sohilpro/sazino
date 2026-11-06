import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { CACHE_VERSION_PREFIX } from './cache-key';
import { CACHE_OPTIONS, type CacheOptions } from './cache.options';

const MAX_BODY_BYTES = 512 * 1024;

@Injectable()
export class StorefrontCacheService {
  private readonly logger = new Logger(StorefrontCacheService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(CACHE_OPTIONS) private readonly options: CacheOptions,
  ) {}

  get enabled(): boolean {
    return this.options.enabled;
  }

  /** نسخه‌ی فعلی؛ null یعنی Redis خراب است (fail-open) */
  async currentVersion(tenantId: string): Promise<string | null> {
    try {
      return (await this.redis.get(CACHE_VERSION_PREFIX + tenantId)) ?? '0';
    } catch (e) {
      this.warn('version', e);
      return null;
    }
  }

  async read(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (e) {
      this.warn('read', e);
      return null;
    }
  }

  async write(key: string, json: string): Promise<void> {
    if (Buffer.byteLength(json) > MAX_BODY_BYTES) return;
    try {
      await this.redis.set(key, json, 'EX', this.options.ttlSeconds);
    } catch (e) {
      this.warn('write', e);
    }
  }

  /** با بالا رفتن نسخه همه‌ی ورودی‌های این فروشگاه بی‌اعتبار می‌شوند */
  async invalidate(tenantId: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.redis.incr(CACHE_VERSION_PREFIX + tenantId);
    } catch (e) {
      this.warn('invalidate', e);
    }
  }

  private warn(action: string, e: unknown): void {
    this.logger.warn(`Cache ${action} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}