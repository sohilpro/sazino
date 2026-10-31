import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../common/transforms';
import { MAX_BLOCKS } from './blocks.schema';

export const HOME_SLUG = 'home';
export const PAGE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SavePageDto {
  /** برای صفحه‌ی جدید لازم است */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  /** هر عضو در سرویس با schema بلاک‌ها اعتبارسنجی می‌شود */
  @IsArray()
  @ArrayMaxSize(MAX_BLOCKS)
  blocks!: unknown[];
}

export class PublicPageQueryDto {
  /** توکن پیش‌نمایش (اختیاری) */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  preview?: string;
}

@Injectable()
export class PageSlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const slug = value.trim().toLowerCase();
    if (slug.length > 60 || !PAGE_SLUG_REGEX.test(slug)) {
      throw new BadRequestException('نشانی صفحه نامعتبر است (فقط حروف انگلیسی کوچک، عدد و خط تیره)');
    }
    return slug;
  }
}