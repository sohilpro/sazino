import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ImageDto, StoreSettingsDto } from '@myapp/shared-types';
import type { Env } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TenantContext } from './tenant-context';
import { InjectTenantDb, type TenantDb } from './tenant-db';
import { TenantResolver } from './tenant-resolver';
import type { SaveStoreSettingsDto } from './store-settings.dto';
import { parseStoreSettings } from './store-settings';
import { buildStoreUrl } from './store-url';
import { StoreUrlService } from './store-url.service';

@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly storage: StorageService,
    private readonly resolver: TenantResolver,
    private readonly storeUrl: StoreUrlService,
  ) {}

  async get(): Promise<StoreSettingsDto> {
    const tenantId = this.ctx.require();
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, subdomain: true, settings: true },
    });
    if (!tenant) throw new NotFoundException('فروشگاه پیدا نشد');

    const settings = parseStoreSettings(tenant.settings);

    let logo: ImageDto | null = null;
    if (settings.logoMediaId) {
      // کلاینت tenant: لوگوی فروشگاه دیگر پیدا نمی‌شود
      const media = await this.db.media.findUnique({
        where: { id: settings.logoMediaId },
        select: { id: true, alt: true, width: true, height: true },
      });
      if (media) logo = { ...media, urls: this.storage.imageUrls(tenantId, media.id) };
    }

    return {
      name: tenant.name,
      subdomain: tenant.subdomain,
      description: settings.description,
      primaryColor: settings.primaryColor,
      font: settings.font,
      logo,
      storeUrl: await this.storeUrl.forCurrentTenant(),
    };
  }

  async update(dto: SaveStoreSettingsDto): Promise<StoreSettingsDto> {
    const tenantId = this.ctx.require();

    if (dto.logoMediaId) {
      const found = await this.db.media.count({ where: { id: dto.logoMediaId } });
      if (found !== 1) throw new BadRequestException('تصویر لوگو نامعتبر است');
    }

    // نوشتن روی خود Tenant با کلاینت tenant ممنوع است (روز ۴)؛ این تنها جای مجاز، با id صریح از context
    const current = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!current) throw new NotFoundException('فروشگاه پیدا نشد');

    // فقط کلیدهای تغییرکرده عوض می‌شوند؛ کلیدهای دیگر (مثل currency) می‌مانند
    const next: Record<string, unknown> =
      typeof current.settings === 'object' &&
      current.settings !== null &&
      !Array.isArray(current.settings)
        ? { ...(current.settings as Record<string, unknown>) }
        : {};

    if (dto.primaryColor !== undefined) next.primaryColor = dto.primaryColor.toLowerCase();
    if (dto.font !== undefined) next.font = dto.font;
    if (dto.description !== undefined) {
      if (dto.description) next.description = dto.description;
      else delete next.description;
    }
    if (dto.logoMediaId !== undefined) {
      if (dto.logoMediaId) next.logoMediaId = dto.logoMediaId;
      else delete next.logoMediaId;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        settings: next as Prisma.InputJsonObject,
      },
    });
    await this.resolver.invalidateTenant(tenantId);

    return this.get();
  }
}
