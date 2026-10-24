import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trim } from '../common/transforms';
import { MAX_ORDER_TOTAL, MAX_SHIPPING_FEE } from './orders.constants';

export class CreateShippingMethodDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  title!: string;

  /** null = حذف توضیح */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @IsInt()
  @Min(0)
  @Max(MAX_SHIPPING_FEE)
  fee!: number;

  /** null = بدون ارسال رایگان */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ORDER_TOTAL)
  freeThreshold?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;
}

export class UpdateShippingMethodDto extends PartialType(CreateShippingMethodDto) {}