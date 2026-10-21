import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SLUG_MAX_LENGTH, SLUG_REGEX } from '../common/slug';
import { trim, trimLower } from '../common/transforms';

export class CreateCategoryDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  /** اگر ندهید از روی نام ساخته می‌شود */
  @IsOptional()
  @Transform(trimLower)
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_REGEX, { message: 'slug فقط می‌تواند شامل حروف، عدد و خط تیره باشد' })
  slug?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  position?: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}