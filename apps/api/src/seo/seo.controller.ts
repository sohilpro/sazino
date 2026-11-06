import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { SitemapUrlsDto } from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { RequireTenant } from '../tenants/require-tenant.decorator';
import { SeoService } from './seo.service';

@ApiTags('storefront')
@Public()
@RequireTenant()
@Controller('storefront')
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('sitemap-urls')
  list(): Promise<SitemapUrlsDto> {
    return this.seo.list();
  }
}