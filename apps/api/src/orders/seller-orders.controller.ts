import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  Paginated,
  SellerOrderDto,
  SellerOrderStats,
  SellerOrderSummaryDto,
} from '@myapp/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { MarkPaidDto, SellerOrderListQueryDto, ShipOrderDto } from './seller-order.dto';
import { SellerOrdersService } from './seller-orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class SellerOrdersController {
  constructor(private readonly orders: SellerOrdersService) {}

  @Get()
  list(@Query() query: SellerOrderListQueryDto): Promise<Paginated<SellerOrderSummaryDto>> {
    return this.orders.list(query);
  }

  // قبل از :number تا «stats» به‌عنوان شماره‌ی سفارش خوانده نشود
  @Get('stats')
  stats(): Promise<SellerOrderStats> {
    return this.orders.stats();
  }

  @Get(':number')
  get(@Param('number', ParseIntPipe) number: number): Promise<SellerOrderDto> {
    return this.orders.get(number);
  }

  @Post(':number/ship')
  @HttpCode(200)
  ship(
    @Param('number', ParseIntPipe) number: number,
    @Body() dto: ShipOrderDto,
  ): Promise<SellerOrderDto> {
    return this.orders.ship(number, dto.trackingCode);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':number/cancel')
  @HttpCode(200)
  cancel(@Param('number', ParseIntPipe) number: number): Promise<SellerOrderDto> {
    return this.orders.cancel(number);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':number/mark-paid')
  @HttpCode(200)
  markPaid(
    @Param('number', ParseIntPipe) number: number,
    @Body() dto: MarkPaidDto,
  ): Promise<SellerOrderDto> {
    return this.orders.markPaid(number, dto.reference);
  }
}