import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { TenantContext } from './tenant-context';
import { InjectTenantDb, type TenantDb } from './tenant-db';
import { buildStoreUrl } from './store-url';

/** آدرس ویترین فروشگاه فعلی: دامنه‌ی اصلی تأییدشده، وگرنه ساب‌دامین پلتفرم */
@Injectable()
export class StoreUrlService {
  private readonly template: string;
  private readonly scheme: 'http' | 'https';

  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    config: ConfigService<Env, true>,
  ) {
    this.template = config.get('STOREFRONT_URL_TEMPLATE', { infer: true });
    this.scheme = config.get('NODE_ENV', { infer: true }) === 'production' ? 'https' : 'http';
  }

  async forCurrentTenant(): Promise<string> {
    const primary = await this.db.domain.findFirst({
      where: { isPrimary: true, status: 'VERIFIED' },
      select: { hostname: true },
    });
    if (primary) return `${this.scheme}://${primary.hostname}`;

    const tenant = await this.db.tenant.findUnique({
      where: { id: this.ctx.require() },
      select: { subdomain: true },
    });
    if (!tenant) throw new NotFoundException('فروشگاه پیدا نشد');
    return buildStoreUrl(this.template, tenant.subdomain);
  }
}