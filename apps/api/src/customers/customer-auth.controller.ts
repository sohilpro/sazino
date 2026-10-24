import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { CustomerDto, CustomerSessionResponse, OtpRequestResponse } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { NoStoreInterceptor } from '../common/no-store.interceptor';
import type { Env } from '../config/env';
import type { Customer } from '../generated/prisma/client';
import { RequireTenant } from '../tenants/require-tenant.decorator';
import { CartService } from './cart.service';
import { dropCookie, readCookie, writeCookie } from './cookies';
import { CurrentCustomer, CustomerGuard } from './customer.guard';
import { RequestOtpDto, UpdateProfileDto, VerifyOtpDto } from './customer.dto';
import { CustomerSessionService } from './customer-session.service';
import { CustomersService, toCustomerDto } from './customers.service';
import { CART_COOKIE, SESSION_COOKIE, SESSION_TTL_DAYS } from './customers.constants';
import { OtpService } from './otp.service';

@ApiTags('storefront-auth')
@Public()
@RequireTenant()
@UseInterceptors(NoStoreInterceptor)
@Controller('storefront/auth')
export class StorefrontAuthController {
  private readonly secure: boolean;

  constructor(
    private readonly otp: OtpService,
    private readonly customers: CustomersService,
    private readonly sessions: CustomerSessionService,
    private readonly cart: CartService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Post('otp')
  @HttpCode(200)
  requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request): Promise<OtpRequestResponse> {
    return this.otp.request(dto.phone, req.ip);
  }

  @Post('verify')
  @HttpCode(200)
  async verify(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CustomerSessionResponse> {
    if (!(await this.otp.verify(dto.phone, dto.code))) {
      throw new UnauthorizedException('کد تأیید نادرست یا منقضی شده است');
    }

    const customer = await this.customers.loginByPhone(dto.phone);
    const session = await this.sessions.create(customer.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 255),
    });

    // سبد مهمان (اگر بود) به حساب مشتری می‌پیوندد
    await this.cart.mergeGuestCart(customer.id, readCookie(req, CART_COOKIE));

    writeCookie(res, SESSION_COOKIE, session.token, SESSION_TTL_DAYS, this.secure);
    dropCookie(res, CART_COOKIE);
    return { customer: toCustomerDto(customer) };
  }

  @Get('session')
  async session(@Req() req: Request): Promise<CustomerSessionResponse> {
    const customer = await this.sessions.resolve(readCookie(req, SESSION_COOKIE));
    return { customer: customer ? toCustomerDto(customer) : null };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.revoke(readCookie(req, SESSION_COOKIE));
    dropCookie(res, SESSION_COOKIE);
  }
}

@ApiTags('storefront-customer')
@Public()
@RequireTenant()
@UseGuards(CustomerGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('storefront/customer')
export class CustomerController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  get(@CurrentCustomer() customer: Customer): CustomerDto {
    return toCustomerDto(customer);
  }

  @Patch()
  async update(@CurrentCustomer() customer: Customer, @Body() dto: UpdateProfileDto): Promise<CustomerDto> {
    return toCustomerDto(await this.customers.updateName(customer.id, dto.name));
  }
}