import { Module } from '@nestjs/common';
import { ImageProcessor } from './image-processor';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, ImageProcessor],
})
export class MediaModule {}