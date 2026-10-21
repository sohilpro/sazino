import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StorefrontController } from './storefront.controller';

@Module({
  controllers: [CategoriesController, ProductsController, StorefrontController],
  providers: [CategoriesService, ProductsService],
})
export class CatalogModule {}