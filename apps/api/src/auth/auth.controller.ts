import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthSession, MeResponse, SubdomainAvailability } from '@myapp/shared-types';
import type { Env } from '../config/env';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants';
import { AuthService, type AuthResult } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CheckSubdomainDto } from './dto/check-subdomain.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { RequestMeta } from './types';

const STRICT_LIMIT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.respond(res, await this.auth.register(dto, this.meta(req)));
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.respond(res, await this.auth.login(dto, this.meta(req)));
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    try {
      const result = await this.auth.refresh(this.readCookie(req), this.meta(req));
      return this.respond(res, result);
    } catch (err) {
      this.clearCookie(res);
      throw err;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.readCookie(req));
    this.clearCookie(res);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser('id') userId: string): Promise<MeResponse> {
    return this.auth.me(userId);
  }

  @Public()
  @Get('check-subdomain')
  checkSubdomain(@Query() query: CheckSubdomainDto): Promise<SubdomainAvailability> {
    return this.auth.checkSubdomain(query.subdomain);
  }

  // ───────────── کمکی‌ها ─────────────
  private respond(res: Response, result: AuthResult): AuthSession {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      expires: result.refreshExpiresAt,
    });
    return result.session;
  }

  private clearCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  private readCookie(req: Request): string | undefined {
    const value = req.cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' ? value : undefined;
  }

  private meta(req: Request): RequestMeta {
    return { ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 255) };
  }
}