import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { StoreInfo } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { RequireTenant } from './require-tenant.decorator';
import { TenantContext } from './tenant-context';

@ApiTags('store')
@Public()
@RequireTenant()
@Controller('store')
export class StoreController {
  constructor(private readonly ctx: TenantContext) {}

  /** اطلاعات عمومی فروشگاهی که از روی Host شناسایی شده */
  @Get()
  info(): StoreInfo {
    const tenant = this.ctx.tenant;
    if (!tenant) throw new NotFoundException('فروشگاه مشخص نشده است');
    return { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain };
  }
}