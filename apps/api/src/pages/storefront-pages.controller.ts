import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { PublicPageDto } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { RequireTenant } from '../tenants/require-tenant.decorator';
import { PageSlugPipe } from './page.dto';
import { PublicPagesService } from './public-pages.service';

@ApiTags('storefront-pages')
@Public()
@RequireTenant()
@Controller('storefront/pages')
export class StorefrontPagesController {
  constructor(private readonly pages: PublicPagesService) {}

  @Get(':slug')
  get(@Param('slug', PageSlugPipe) slug: string): Promise<PublicPageDto> {
    return this.pages.get(slug);
  }
}