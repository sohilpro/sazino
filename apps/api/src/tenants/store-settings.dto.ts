import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { trim, trimLower } from '../common/transforms';
import { HEX_COLOR, MAX_DESCRIPTION_LENGTH, STORE_FONTS, type StoreFontKey } from './store-settings';

export class SaveStoreSettingsDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'نام فروشگاه باید حداقل ۲ کاراکتر باشد' })
  @MaxLength(60)
  name?: string;

  /** رشته‌ی خالی یا null = حذف توضیح */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string | null;

  @IsOptional()
  @Transform(trimLower)
  @Matches(HEX_COLOR, { message: 'رنگ باید با فرمت #rrggbb باشد' })
  primaryColor?: string;

  @IsOptional()
  @IsIn(STORE_FONTS as readonly string[])
  font?: StoreFontKey;

  /** null = حذف لوگو */
  @IsOptional()
  @IsUUID()
  logoMediaId?: string | null;
}