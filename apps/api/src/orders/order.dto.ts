import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';
import { trim } from '../common/transforms';
import { MAX_ORDER_TOTAL } from './orders.constants';

export class CreateOrderDto {
  @IsUUID()
  addressId!: string;

  @IsUUID()
  shippingMethodId!: string;

  /** مبلغی که به مشتری نشان داده شده؛ اگر با محاسبه‌ی سرور فرق کند سفارش ثبت نمی‌شود */
  @IsInt()
  @Min(0)
  @Max(MAX_ORDER_TOTAL)
  expectedTotal!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class QuoteQueryDto {
  @IsUUID()
  shippingMethodId!: string;
}

export class OrderListQueryDto extends PaginationQueryDto {}