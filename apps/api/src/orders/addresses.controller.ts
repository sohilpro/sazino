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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AddressDto } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { NoStoreInterceptor } from '../common/no-store.interceptor';
import { CurrentCustomer, CustomerGuard } from '../customers/customer.guard';
import type { Customer } from '../generated/prisma/client';
import { RequireTenant } from '../tenants/require-tenant.decorator';
import { CreateAddressDto, UpdateAddressDto } from './address.dto';
import { AddressesService } from './addresses.service';

@ApiTags('storefront-addresses')
@Public()
@RequireTenant()
@UseGuards(CustomerGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('storefront/addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentCustomer() customer: Customer): Promise<AddressDto[]> {
    return this.addresses.list(customer.id);
  }

  @Post()
  create(@CurrentCustomer() customer: Customer, @Body() dto: CreateAddressDto): Promise<AddressDto> {
    return this.addresses.create(customer.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentCustomer() customer: Customer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressDto> {
    return this.addresses.update(customer.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentCustomer() customer: Customer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.addresses.remove(customer.id, id);
  }
}