import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { PaymentOutcomeDto, StartPaymentResponse } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { NoStoreInterceptor } from '../common/no-store.interceptor';
import type { Env } from '../config/env';
import { CurrentCustomer, CustomerGuard } from '../customers/customer.guard';
import type { Customer } from '../generated/prisma/client';
import { RequireTenant } from '../tenants/require-tenant.decorator';
import { requestHost } from '../tenants/host';
import { PaymentCallbackDto } from './payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('storefront-payments')
@Public()
@RequireTenant()
@UseInterceptors(NoStoreInterceptor)
@Controller('storefront')
export class StorefrontPaymentsController {
  private readonly scheme: 'http' | 'https';

  constructor(
    private readonly payments: PaymentsService,
    config: ConfigService<Env, true>,
  ) {
    this.scheme = config.get('NODE_ENV', { infer: true }) === 'production' ? 'https' : 'http';
  }

  @Post('orders/:number/pay')
  @UseGuards(CustomerGuard)
  @HttpCode(200)
  pay(
    @CurrentCustomer() customer: Customer,
    @Param('number', ParseIntPipe) number: number,
    @Req() req: Request,
  ): Promise<StartPaymentResponse> {
    return this.payments.start(customer, number, this.callbackOrigin(req));
  }

  /** عمومی: صحت پرداخت را فقط خود درگاه تعیین می‌کند، نه نشست مشتری */
  @Post('payments/callback')
  @HttpCode(200)
  callback(@Body() dto: PaymentCallbackDto): Promise<PaymentOutcomeDto> {
    return this.payments.handleCallback(dto.authority, dto.status.toUpperCase());
  }

  /** آدرسی که درگاه کاربر را به آن برمی‌گرداند (Host همان فروشگاه که قبلاً شناسایی و تأیید شده) */
  private callbackOrigin(req: Request): string {
    const host = requestHost(req.headers)?.split(',')[0]?.trim().toLowerCase();
    if (!host || !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/.test(host)) {
      throw new BadRequestException('آدرس فروشگاه نامعتبر است');
    }
    return `${this.scheme}://${host}`;
  }
}