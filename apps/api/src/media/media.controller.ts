import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/pagination';
import { MAX_UPLOAD_BYTES } from './media.constants';
import { UpdateMediaDto, UploadMediaDto } from './media.dto';
import { MediaService } from './media.service';
import type { UploadedImageFile } from './uploaded-file';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    // بدون storage مشخص، multer فایل را در حافظه نگه می‌دارد (حداکثر ۵ مگابایت)
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 } }),
  )
  upload(@UploadedFile() file: UploadedImageFile | undefined, @Body() dto: UploadMediaDto) {
    return this.media.upload(file, dto);
  }

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.media.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMediaDto) {
    return this.media.update(id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.media.remove(id);
  }
}