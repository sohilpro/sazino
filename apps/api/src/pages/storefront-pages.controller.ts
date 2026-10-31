import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { PublicPageDto } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { RequireTenant } from '../tenants/require-tenant.decorator';
import { PageSlugPipe, PublicPageQueryDto } from './page.dto';
import { PublicPagesService } from './public-pages.service';

@ApiTags('storefront-pages')
@Public()
@RequireTenant()
@Controller('storefront/pages')
export class StorefrontPagesController {
  constructor(private readonly pages: PublicPagesService) {}

  @Get(':slug')
  get(
    @Param('slug', PageSlugPipe) slug: string,
    @Query() query: PublicPageQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicPageDto> {
    if (query.preview !== undefined) {
      // پیش‌نویس نباید کش یا ایندکس شود
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
    return this.pages.get(slug, query.preview);
  }
}