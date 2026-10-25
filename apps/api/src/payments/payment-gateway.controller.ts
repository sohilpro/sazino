import { Body, Controller, Delete, Get, HttpCode, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PaymentGatewayDto } from '@myapp/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { SaveGatewayDto } from './payment-gateway.dto';
import { PaymentGatewayService } from './payment-gateway.service';

@ApiTags('payment-gateway')
@ApiBearerAuth()
@Controller('payment-gateway')
export class PaymentGatewayController {
  constructor(private readonly gateway: PaymentGatewayService) {}

  @Roles('OWNER', 'ADMIN')
  @Get()
  get(): Promise<PaymentGatewayDto> {
    return this.gateway.get();
  }

  @Roles('OWNER')
  @Put()
  save(@Body() dto: SaveGatewayDto): Promise<PaymentGatewayDto> {
    return this.gateway.save(dto);
  }

  @Roles('OWNER')
  @Delete()
  @HttpCode(204)
  async remove(): Promise<void> {
    await this.gateway.remove();
  }
}