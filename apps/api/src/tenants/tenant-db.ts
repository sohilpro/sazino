import { Inject } from '@nestjs/common';
import type { createTenantClient } from './tenant-client';

export const TENANT_DB = Symbol('TENANT_DB');
export type TenantDb = ReturnType<typeof createTenantClient>;

/** کلاینت دیتابیسِ فیلترشده بر اساس tenant فعلی؛ در سرویس‌های فیچر فقط از این استفاده کن */
export const InjectTenantDb = () => Inject(TENANT_DB);