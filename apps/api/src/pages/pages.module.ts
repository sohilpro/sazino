import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { PublicPagesService } from './public-pages.service';
import { StorefrontPagesController } from './storefront-pages.controller';
import { PreviewTokenService } from './preview-token.service';

@Module({
  controllers: [PagesController, StorefrontPagesController],
  providers: [PagesService, PublicPagesService, PreviewTokenService],
  exports: [PagesService],
})
export class PagesModule {}
