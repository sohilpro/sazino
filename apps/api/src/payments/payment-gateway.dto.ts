import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, Matches } from 'class-validator';
import { trim } from '../common/transforms';

const MERCHANT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SaveGatewayDto {
  /** اگر ندهید فقط isActive تغییر می‌کند */
  @IsOptional()
  @Transform(trim)
  @Matches(MERCHANT_ID, { message: 'شناسه‌ی پذیرنده باید کد ۳۶ کاراکتری زرین‌پال باشد' })
  merchantId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}