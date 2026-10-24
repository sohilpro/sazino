import { Injectable } from '@nestjs/common';
import type { CustomerDto } from '@myapp/shared-types';
import { isUniqueViolation } from '../common/prisma-errors';
import type { Customer } from '../generated/prisma/client';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';

export const toCustomerDto = (c: Customer): CustomerDto => ({
  id: c.id,
  phone: c.phone,
  name: c.name,
  createdAt: c.createdAt.toISOString(),
});

@Injectable()
export class CustomersService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
  ) {}

  /** ورود و ثبت‌نام یکی است: اگر این شماره در این فروشگاه نبود ساخته می‌شود */
  async loginByPhone(phone: string): Promise<Customer> {
    const tenantId = this.ctx.require();

    let customer = await this.db.customer.findFirst({ where: { phone } });
    if (!customer) {
      try {
        customer = await this.db.customer.create({ data: { tenantId, phone } });
      } catch (err) {
        // رقابت هم‌زمان: دیگری همین شماره را ساخته است
        if (!isUniqueViolation(err)) throw err;
        customer = await this.db.customer.findFirst({ where: { phone } });
        if (!customer) throw err;
      }
    }

    return this.db.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });
  }

  updateName(id: string, name: string | undefined): Promise<Customer> {
    return this.db.customer.update({ where: { id }, data: { name } });
  }
}