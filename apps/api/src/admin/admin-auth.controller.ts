import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AdminDto } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { NoStoreInterceptor } from '../common/no-store.interceptor';
import type { Env } from '../config/env';
import { toAdminDto, AdminAuthService } from './admin-auth.service';
import { ADMIN_COOKIE, ADMIN_COOKIE_PATH, ADMIN_SESSION_TTL_MS } from './admin.constants';
import { AdminLoginDto } from './admin.dto';
import { AdminGuard, CurrentAdmin, type AdminActor } from './admin.guard';
import { UseInterceptors } from '@nestjs/common';

const readToken = (req: Request): string | undefined => {
  const v = (req.cookies as Record<string, unknown> | undefined)?.[ADMIN_COOKIE];
  return typeof v === 'string' ? v : undefined;
};

@ApiTags('admin-auth')
@Public() // توکن فروشنده (JwtAuthGuard) اینجا بی‌معنی است؛ AdminGuard جدا اعمال می‌شود
@UseInterceptors(NoStoreInterceptor)
@Controller('admin/auth')
export class AdminAuthController {
  private readonly secure: boolean;

  constructor(
    private readonly auth: AdminAuthService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminDto> {
    const { token, admin } = await this.auth.login(dto.email, dto.password, {
      ip: req.ip ?? 'unknown',
      userAgent: req.headers['user-agent']?.slice(0, 255),
    });

    res.cookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.secure,
      path: ADMIN_COOKIE_PATH,
      maxAge: ADMIN_SESSION_TTL_MS,
    });
    return admin;
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@CurrentAdmin() actor: AdminActor, @Req() req: Request & { admin?: Parameters<typeof toAdminDto>[0] }): AdminDto {
    return toAdminDto(req.admin ?? { id: actor.id, email: actor.email, name: '' });
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readToken(req));
    res.clearCookie(ADMIN_COOKIE, { path: ADMIN_COOKIE_PATH });
  }
}