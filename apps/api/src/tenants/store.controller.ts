import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { StoreInfo } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { RequireTenant } from './require-tenant.decorator';
import { StoreService } from './store.service';

@ApiTags('store')
@Public()
@RequireTenant()
@Controller('store')
export class StoreController {
  constructor(private readonly store: StoreService) {}

  /** اطلاعات عمومی و ظاهر فروشگاهی که از روی Host شناسایی شده */
  @Get()
  info(): Promise<StoreInfo> {
    return this.store.info();
  }
}