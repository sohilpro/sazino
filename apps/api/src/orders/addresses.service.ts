import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AddressDto } from '@myapp/shared-types';
import type { CustomerAddress } from '../generated/prisma/client';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import type { CreateAddressDto, UpdateAddressDto } from './address.dto';
import { MAX_ADDRESSES } from './orders.constants';

const toAddressDto = (a: CustomerAddress): AddressDto => ({
  id: a.id,
  recipientName: a.recipientName,
  recipientPhone: a.recipientPhone,
  province: a.province,
  city: a.city,
  address: a.address,
  postalCode: a.postalCode,
  isDefault: a.isDefault,
});

@Injectable()
export class AddressesService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
  ) {}

  async list(customerId: string): Promise<AddressDto[]> {
    const rows = await this.db.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toAddressDto);
  }

  /** فقط نشانی‌ای که متعلق به همین مشتری است */
  findOwned(customerId: string, id: string): Promise<CustomerAddress | null> {
    return this.db.customerAddress.findFirst({ where: { id, customerId } });
  }

  async create(customerId: string, dto: CreateAddressDto): Promise<AddressDto> {
    const tenantId = this.ctx.require();

    return this.db.$transaction(async (tx) => {
      const count = await tx.customerAddress.count({ where: { customerId } });
      if (count >= MAX_ADDRESSES) {
        throw new ConflictException(`حداکثر ${MAX_ADDRESSES} نشانی می‌توانید ذخیره کنید`);
      }

      // اولین نشانی همیشه پیش‌فرض است
      const makeDefault = dto.isDefault === true || count === 0;
      if (makeDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const row = await tx.customerAddress.create({
        data: {
          tenantId,
          customerId,
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          province: dto.province,
          city: dto.city,
          address: dto.address,
          postalCode: dto.postalCode,
          isDefault: makeDefault,
        },
      });
      return toAddressDto(row);
    });
  }

  async update(customerId: string, id: string, dto: UpdateAddressDto): Promise<AddressDto> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.customerAddress.findFirst({
        where: { id, customerId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('نشانی پیدا نشد');

      if (dto.isDefault === true) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      const row = await tx.customerAddress.update({
        where: { id },
        data: {
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          province: dto.province,
          city: dto.city,
          address: dto.address,
          postalCode: dto.postalCode,
          // پیش‌فرض را فقط با انتخاب نشانی دیگر می‌شود عوض کرد
          isDefault: dto.isDefault === true ? true : undefined,
        },
      });
      return toAddressDto(row);
    });
  }

  async remove(customerId: string, id: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const row = await tx.customerAddress.findFirst({
        where: { id, customerId },
        select: { id: true, isDefault: true },
      });
      if (!row) throw new NotFoundException('نشانی پیدا نشد');

      await tx.customerAddress.delete({ where: { id } });

      if (row.isDefault) {
        const next = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (next) {
          await tx.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
        }
      }
    });
  }
}