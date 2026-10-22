import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { trim } from '../common/transforms';
import { MAX_PRODUCT_IMAGES } from './media.constants';

export class UploadMediaDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  alt?: string;
}

export class UpdateMediaDto {
  /** رشته‌ی خالی یا null = حذف متن جایگزین */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  alt?: string | null;
}

export class SetProductImagesDto {
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_IMAGES)
  @IsUUID('all', { each: true })
  mediaIds!: string[];
}