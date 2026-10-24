import { Injectable, NotFoundException } from '@nestjs/common';
import type { SellerShippingMethodDto, ShippingMethodDto } from '@myapp/shared-types';
import type { ShippingMethod } from '../generated/prisma/client';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import type { CreateShippingMethodDto, UpdateShippingMethodDto } from './shipping.dto';

const toPublic = (m: ShippingMethod): ShippingMethodDto => ({
  id: m.id,
  title: m.title,
  description: m.description,
  fee: m.fee,
  freeThreshold: m.freeThreshold,
});

const toSeller = (m: ShippingMethod): SellerShippingMethodDto => ({
  ...toPublic(m),
  isActive: m.isActive,
  position: m.position,
});

const ORDER = [{ position: 'asc' }, { createdAt: 'asc' }] as const;

@Injectable()
export class ShippingService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
  ) {}

  async listPublic(): Promise<ShippingMethodDto[]> {
    const rows = await this.db.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: [...ORDER],
    });
    return rows.map(toPublic);
  }

  async listAll(): Promise<SellerShippingMethodDto[]> {
    const rows = await this.db.shippingMethod.findMany({ orderBy: [...ORDER] });
    return rows.map(toSeller);
  }

  /** فقط روش فعال همین فروشگاه */
  findActive(id: string): Promise<ShippingMethod | null> {
    return this.db.shippingMethod.findFirst({ where: { id, isActive: true } });
  }

  async create(dto: CreateShippingMethodDto): Promise<SellerShippingMethodDto> {
    const row = await this.db.shippingMethod.create({
      data: {
        tenantId: this.ctx.require(),
        title: dto.title,
        description: dto.description ?? null,
        fee: dto.fee,
        freeThreshold: dto.freeThreshold ?? null,
        isActive: dto.isActive ?? true,
        position: dto.position ?? 0,
      },
    });
    return toSeller(row);
  }

  async update(id: string, dto: UpdateShippingMethodDto): Promise<SellerShippingMethodDto> {
    const exists = await this.db.shippingMethod.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('روش ارسال پیدا نشد');

    const row = await this.db.shippingMethod.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        fee: dto.fee,
        freeThreshold: dto.freeThreshold,
        isActive: dto.isActive,
        position: dto.position,
      },
    });
    return toSeller(row);
  }

  async remove(id: string): Promise<void> {
    // سفارش‌های قبلی snapshot دارند؛ حذف مشکلی ایجاد نمی‌کند
    const { count } = await this.db.shippingMethod.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundException('روش ارسال پیدا نشد');
  }
}