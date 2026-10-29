import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { OrderStatus } from '@myapp/shared-types';
import { PaginationQueryDto } from '../common/pagination';
import { trim } from '../common/transforms';
import { normalizeDigits } from '../common/phone';

const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'SHIPPED', 'CANCELED'];

export class SellerOrderListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: OrderStatus;

  /** شماره‌ی سفارش، نام گیرنده یا شماره‌ی موبایل (کامل یا بخشی) */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ShipOrderDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeDigits(value).trim() : value))
  @Matches(/^[A-Za-z0-9][A-Za-z0-9\-_ ]{2,63}$/, {
    message: 'کد رهگیری فقط شامل حروف انگلیسی، عدد، خط تیره و فاصله (۳ تا ۶۴ کاراکتر) است',
  })
  trackingCode?: string;
}

export class MarkPaidDto {
  /** شماره‌ی پیگیری یا توضیح (مثلاً ۴ رقم آخر کارت واریزکننده) */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  reference?: string;
}