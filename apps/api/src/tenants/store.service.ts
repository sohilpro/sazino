import { Injectable, NotFoundException } from '@nestjs/common';
import type { StoreInfo } from '@myapp/shared-types';
import { StorageService } from '../storage/storage.service';
import { TenantContext } from './tenant-context';
import { InjectTenantDb, type TenantDb } from './tenant-db';
import { parseStoreSettings } from './store-settings';
import { StoreUrlService } from './store-url.service';

@Injectable()
export class StoreService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly storage: StorageService,
    private readonly storeUrl: StoreUrlService,
  ) {}

  async info(): Promise<StoreInfo> {
    const tenantId = this.ctx.require();

    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, subdomain: true, settings: true },
    });
    if (!tenant) throw new NotFoundException('فروشگاه پیدا نشد');

    const settings = parseStoreSettings(tenant.settings);

    // کلاینت tenant: لوگوی فروشگاه دیگر پیدا نمی‌شود و نادیده گرفته می‌شود
    let logoUrl: string | null = null;
    if (settings.logoMediaId) {
      const media = await this.db.media.findUnique({
        where: { id: settings.logoMediaId },
        select: { id: true, tenantId: true },
      });
      if (media) logoUrl = this.storage.imageUrls(media.tenantId, media.id).sm;
    }

    return {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      description: settings.description,
      logoUrl,
      theme: { primaryColor: settings.primaryColor, font: settings.font },
      canonicalUrl: await this.storeUrl.forCurrentTenant(),
    };
  }
}
