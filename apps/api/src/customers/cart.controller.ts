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
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { CartDto } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { NoStoreInterceptor } from '../common/no-store.interceptor';
import type { Env } from '../config/env';
import { RequireTenant } from '../tenants/require-tenant.decorator';
import { CartService, type CartIdentity } from './cart.service';
import { readCookie, writeCookie } from './cookies';
import { AddCartItemDto, SetCartItemDto } from './customer.dto';
import { CustomerSessionService } from './customer-session.service';
import { CART_COOKIE, CART_COOKIE_DAYS, SESSION_COOKIE } from './customers.constants';

@ApiTags('storefront-cart')
@Public()
@RequireTenant()
@UseInterceptors(NoStoreInterceptor)
@Controller('storefront/cart')
export class CartController {
  private readonly secure: boolean;

  constructor(
    private readonly cart: CartService,
    private readonly sessions: CustomerSessionService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  /** مشتری واردشده: سبد خودش. وگرنه سبد مهمان از روی کوکی */
  private async identity(req: Request): Promise<CartIdentity> {
    const customer = await this.sessions.resolve(readCookie(req, SESSION_COOKIE));
    return customer
      ? { customerId: customer.id }
      : { guestToken: readCookie(req, CART_COOKIE) };
  }

  @Get()
  async view(@Req() req: Request): Promise<CartDto> {
    return this.cart.view(await this.identity(req));
  }

  @Post('items')
  @HttpCode(200)
  async add(
    @Body() dto: AddCartItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartDto> {
    const { cart, guestToken } = await this.cart.add(
      await this.identity(req),
      dto.variantId,
      dto.quantity,
    );
    if (guestToken) writeCookie(res, CART_COOKIE, guestToken, CART_COOKIE_DAYS, this.secure);
    return cart;
  }

  @Patch('items/:variantId')
  async setQuantity(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: SetCartItemDto,
    @Req() req: Request,
  ): Promise<CartDto> {
    return this.cart.setQuantity(await this.identity(req), variantId, dto.quantity);
  }

  @Delete('items/:variantId')
  async remove(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Req() req: Request,
  ): Promise<CartDto> {
    return this.cart.remove(await this.identity(req), variantId);
  }

  @Delete()
  async clear(@Req() req: Request): Promise<CartDto> {
    return this.cart.clear(await this.identity(req));
  }
}