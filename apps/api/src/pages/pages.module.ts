import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { PublicPagesService } from './public-pages.service';
import { StorefrontPagesController } from './storefront-pages.controller';

@Module({
  controllers: [PagesController, StorefrontPagesController],
  providers: [PagesService, PublicPagesService],
  exports: [PagesService],
})
export class PagesModule {}