import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SellerShippingMethodDto, ShippingMethodDto } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireTenant } from '../tenants/require-tenant.decorator';
import { CreateShippingMethodDto, UpdateShippingMethodDto } from './shipping.dto';
import { ShippingService } from './shipping.service';

/** ویترین: روش‌های ارسال فعال (عمومی) */
@ApiTags('storefront-shipping')
@Public()
@RequireTenant()
@Controller('storefront/shipping-methods')
export class StorefrontShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get()
  list(): Promise<ShippingMethodDto[]> {
    return this.shipping.listPublic();
  }
}

/** پنل فروشنده */
@ApiTags('shipping')
@ApiBearerAuth()
@Controller('shipping-methods')
export class ShippingMethodsController {
  constructor(private readonly shipping: ShippingService) {}

  @Get()
  list(): Promise<SellerShippingMethodDto[]> {
    return this.shipping.listAll();
  }

  @Roles('OWNER', 'ADMIN')
  @Post()
  create(@Body() dto: CreateShippingMethodDto): Promise<SellerShippingMethodDto> {
    return this.shipping.create(dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShippingMethodDto,
  ): Promise<SellerShippingMethodDto> {
    return this.shipping.update(id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.shipping.remove(id);
  }
}