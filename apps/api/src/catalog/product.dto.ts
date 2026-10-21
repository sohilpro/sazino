import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { ProductStatus } from '@myapp/shared-types';
import { PaginationQueryDto } from '../common/pagination';
import { SLUG_MAX_LENGTH, SLUG_REGEX } from '../common/slug';
import { trim, trimLower } from '../common/transforms';
import {
  MAX_PRICE,
  MAX_QUANTITY,
  MAX_VARIANTS_PER_PRODUCT,
  PRODUCT_SORTS,
  PRODUCT_STATUSES,
  type ProductSort,
} from './catalog.constants';

export class CreateVariantDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku?: string;

  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  compareAtPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;
}

export class UpdateVariantDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  /** null = حذف SKU */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price?: number;

  /** null = حذف قیمت قبل از تخفیف */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  compareAtPrice?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;
}

export class UpdateInventoryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;
}

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  /** اگر ندهید از روی عنوان ساخته می‌شود */
  @IsOptional()
  @Transform(trimLower)
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_REGEX, { message: 'slug فقط می‌تواند شامل حروف، عدد و خط تیره باشد' })
  slug?: string;

  /** متن خام؛ اگر HTML نمایش داده می‌شود باید سمت نمایش پاک‌سازی شود */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20_000)
  description?: string | null;

  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatus;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_VARIANTS_PER_PRODUCT)
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants!: CreateVariantDto[];
}

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['variants'] as const),
) {}

export class ProductListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatus;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;
}

export class StorefrontProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(trimLower)
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  categorySlug?: string;

  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;
}