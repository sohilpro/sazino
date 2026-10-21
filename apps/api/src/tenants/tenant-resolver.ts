import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { isIpv4, normalizeHost } from './host';
import { RESERVED_SUBDOMAINS, SUBDOMAIN_REGEX } from './subdomain';
import type { HostResolution, TenantInfo } from './tenant.types';

export const CACHE_PREFIX = 'tenant:host:';
export const NEGATIVE_MARKER = '__none__';
const POSITIVE_TTL_SECONDS = 60;
const NEGATIVE_TTL_SECONDS = 30;

const PLATFORM: HostResolution = { type: 'platform' };
const NOT_FOUND: HostResolution = { type: 'not_found' };

const tenantSelect = { id: true, name: true, subdomain: true, plan: true, status: true } as const;

@Injectable()
export class TenantResolver {
  private readonly logger = new Logger(TenantResolver.name);
  readonly platformDomain: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService<Env, true>,
  ) {
    this.platformDomain = config.get('PLATFORM_DOMAIN', { infer: true }).toLowerCase();
  }

  /**
   * @param explicit true یعنی کلاینت (مثلاً Nuxt SSR) صراحتاً tenant خواسته (هدر x-tenant-host)؛
   *                 در این حالت میزبان ناشناخته = not_found، نه platform.
   */
  async resolve(rawHost: string | undefined, opts: { explicit: boolean }): Promise<HostResolution> {
    const host = normalizeHost(rawHost);
    if (!host) return opts.explicit ? NOT_FOUND : PLATFORM;

    const domain = this.platformDomain;
    if (host === domain) return PLATFORM;

    // ۱) ساب‌دامین پلتفرم: demo.myapp.com
    if (host.endsWith(`.${domain}`)) {
      const label = host.slice(0, -(domain.length + 1));
      if (RESERVED_SUBDOMAINS.has(label)) return PLATFORM;
      if (!SUBDOMAIN_REGEX.test(label)) return NOT_FOUND;
      const tenant = await this.lookup(host, () => this.findBySubdomain(label));
      return tenant ? { type: 'tenant', tenant } : NOT_FOUND;
    }

    // ۲) IP و نام‌های تک‌بخشی (مثل نام سرویس‌های docker) هرگز فروشگاه نیستند
    if (isIpv4(host) || !host.includes('.')) return opts.explicit ? NOT_FOUND : PLATFORM;

    // ۳) دامنه‌ی اختصاصی: www.customer.ir
    const tenant = await this.lookup(host, () => this.findByCustomDomain(host));
    if (tenant) return { type: 'tenant', tenant };
    return opts.explicit ? NOT_FOUND : PLATFORM;
  }

  // ───────────── ابطال کش ─────────────
  async invalidateSubdomain(subdomain: string): Promise<void> {
    await this.invalidateHosts([`${subdomain}.${this.platformDomain}`]);
  }

  /** بعد از تغییر وضعیت/نام/دامنه‌های یک فروشگاه صدا بزن */
  async invalidateTenant(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subdomain: true, domains: { select: { hostname: true } } },
    });
    if (!tenant) return;
    await this.invalidateHosts([
      `${tenant.subdomain}.${this.platformDomain}`,
      ...tenant.domains.map((d) => d.hostname),
    ]);
  }

  async invalidateHosts(hosts: string[]): Promise<void> {
    if (hosts.length === 0) return;
    try {
      await this.redis.del(...hosts.map((h) => CACHE_PREFIX + h));
    } catch (err) {
      this.logger.warn(`Cache invalidation failed: ${(err as Error).message}`);
    }
  }

  // ───────────── داخلی ─────────────
  private async lookup(
    host: string,
    loader: () => Promise<TenantInfo | null>,
  ): Promise<TenantInfo | null> {
    const key = CACHE_PREFIX + host;

    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        if (cached === NEGATIVE_MARKER) return null;
        return JSON.parse(cached) as TenantInfo;
      }
    } catch (err) {
      // خرابی Redis نباید سایت را از کار بیندازد؛ مستقیم سراغ DB می‌رویم
      this.logger.warn(`Cache read failed: ${(err as Error).message}`);
    }

    const tenant = await loader();

    try {
      if (tenant) await this.redis.set(key, JSON.stringify(tenant), 'EX', POSITIVE_TTL_SECONDS);
      else await this.redis.set(key, NEGATIVE_MARKER, 'EX', NEGATIVE_TTL_SECONDS);
    } catch (err) {
      this.logger.warn(`Cache write failed: ${(err as Error).message}`);
    }
    return tenant;
  }

  private findBySubdomain(subdomain: string) {
    return this.prisma.tenant.findUnique({ where: { subdomain }, select: tenantSelect });
  }

  private async findByCustomDomain(hostname: string) {
    const row = await this.prisma.domain.findFirst({
      where: { hostname, status: 'VERIFIED' },
      select: { tenant: { select: tenantSelect } },
    });
    return row?.tenant ?? null;
  }
}