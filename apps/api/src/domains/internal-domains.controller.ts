import { Controller, Get, NotFoundException, Query, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { InternalDomainsService } from './internal-domains.service';

export class DomainCheckQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  domain?: string;
}

/**
 * فقط برای Caddy (on-demand TLS ask). از بیرون در دسترس نیست (Caddy این مسیر را مسدود می‌کند)
 * و توکن مشترک هم لازم دارد. پاسخ: ۲۰۰ = مجاز، ۴۰۴ = غیرمجاز.
 */
@Public()
@SkipThrottle()
@Controller('internal/domains')
export class InternalDomainsController {
  constructor(private readonly internal: InternalDomainsService) {}

  @Get('check')
  async check(
    @Query() query: DomainCheckQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    res.setHeader('Cache-Control', 'no-store');
    if (!this.internal.tokenValid(query.token) || !(await this.internal.isAllowed(query.domain))) {
      throw new NotFoundException();
    }
    return { ok: true };
  }
}