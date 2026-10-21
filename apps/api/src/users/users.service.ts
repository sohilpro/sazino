import { Injectable } from '@nestjs/common';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';

@Injectable()
export class UsersService {
  constructor(@InjectTenantDb() private readonly db: TenantDb) {}

  /** فیلتر tenant خودکار اعمال می‌شود؛ passwordHash هرگز برنمی‌گردد */
  list() {
    return this.db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}