import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { RequireTenant } from '../tenants/require-tenant.decorator';
import { CategoriesService } from './categories.service';
import { StorefrontProductQueryDto } from './product.dto';
import { ProductsService } from './products.service';

/** API عمومی ویترین؛ فروشگاه از روی Host شناسایی می‌شود */
@ApiTags('storefront')
@Public()
@RequireTenant()
@Controller('storefront')
export class StorefrontController {
  constructor(
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
  ) {}

  @Get('products')
  listProducts(@Query() query: StorefrontProductQueryDto) {
    return this.products.listPublic(query);
  }

  @Get('products/:slug')
  getProduct(@Param('slug') slug: string) {
    return this.products.getPublicBySlug(slug);
  }

  @Get('categories')
  listCategories() {
    return this.categories.listPublic();
  }

  @Get('categories/:slug')
  getCategory(@Param('slug') slug: string) {
    return this.categories.getPublicBySlug(slug);
  }
}