import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  CheckoutQuoteDto,
  OrderDto,
  OrderSummaryDto,
  Paginated,
} from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { NoStoreInterceptor } from '../common/no-store.interceptor';
import { CurrentCustomer, CustomerGuard } from '../customers/customer.guard';
import type { Customer } from '../generated/prisma/client';
import { RequireTenant } from '../tenants/require-tenant.decorator';
import { CreateOrderDto, OrderListQueryDto, QuoteQueryDto } from './order.dto';
import { OrdersService } from './orders.service';

@ApiTags('storefront-checkout')
@Public()
@RequireTenant()
@UseGuards(CustomerGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('storefront/checkout')
export class CheckoutController {
  constructor(private readonly orders: OrdersService) {}

  @Get('quote')
  quote(
    @CurrentCustomer() customer: Customer,
    @Query() query: QuoteQueryDto,
  ): Promise<CheckoutQuoteDto> {
    return this.orders.quote(customer.id, query.shippingMethodId);
  }
}

@ApiTags('storefront-orders')
@Public()
@RequireTenant()
@UseGuards(CustomerGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('storefront/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@CurrentCustomer() customer: Customer, @Body() dto: CreateOrderDto): Promise<OrderDto> {
    return this.orders.create(customer.id, dto);
  }

  @Get()
  list(
    @CurrentCustomer() customer: Customer,
    @Query() query: OrderListQueryDto,
  ): Promise<Paginated<OrderSummaryDto>> {
    return this.orders.list(customer.id, query);
  }

  @Get(':number')
  get(
    @CurrentCustomer() customer: Customer,
    @Param('number', ParseIntPipe) number: number,
  ): Promise<OrderDto> {
    return this.orders.getByNumber(customer.id, number);
  }

  @Post(':number/cancel')
  @HttpCode(200)
  cancel(
    @CurrentCustomer() customer: Customer,
    @Param('number', ParseIntPipe) number: number,
  ): Promise<OrderDto> {
    return this.orders.cancelByCustomer(customer.id, number);
  }
}