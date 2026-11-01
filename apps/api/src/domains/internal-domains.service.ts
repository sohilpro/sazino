import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Env } from '../config/env';
import { TenantResolver } from '../tenants/tenant-resolver';

@Injectable()
export class InternalDomainsService {
  private readonly tokenDigest: Buffer | null;

  constructor(
    private readonly resolver: TenantResolver,
    config: ConfigService<Env, true>,
  ) {
    const token = config.get('INTERNAL_API_TOKEN', { infer: true });
    this.tokenDigest = token ? createHash('sha256').update(token).digest() : null;
  }

  /** مقایسه‌ی ثابت‌زمان؛ بدون توکن تنظیم‌شده، همه‌چیز رد می‌شود */
  tokenValid(candidate: string | undefined): boolean {
    if (!this.tokenDigest || !candidate) return false;
    return timingSafeEqual(createHash('sha256').update(candidate).digest(), this.tokenDigest);
  }

  /** فقط ساب‌دامین فروشگاه فعال یا دامنه‌ی تأییدشده‌ی فروشگاه فعال گواهی می‌گیرد */
  async isAllowed(domain: string | undefined): Promise<boolean> {
    if (!domain) return false;
    const result = await this.resolver.resolve(domain, { explicit: true });
    return result.type === 'tenant' && result.tenant.status === 'ACTIVE';
  }
}