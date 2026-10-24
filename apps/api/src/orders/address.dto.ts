import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IRAN_PROVINCES } from '../common/iran';
import { normalizePersian } from '../common/persian';
import { normalizeDigits, normalizePhone, PHONE_REGEX } from '../common/phone';

const text = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizePersian(value) : value;
const phone = ({ value }: { value: unknown }) => normalizePhone(value) ?? value;
const postal = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeDigits(value).replace(/[\s-]/g, '') : value;

export class CreateAddressDto {
  @Transform(text)
  @IsString()
  @MinLength(2, { message: 'نام گیرنده باید حداقل ۲ کاراکتر باشد' })
  @MaxLength(60)
  recipientName!: string;

  @Transform(phone)
  @Matches(PHONE_REGEX, { message: 'شماره‌ی موبایل گیرنده معتبر نیست' })
  recipientPhone!: string;

  @Transform(text)
  @IsIn(IRAN_PROVINCES as readonly string[], { message: 'استان نامعتبر است' })
  province!: string;

  @Transform(text)
  @IsString()
  @MinLength(2, { message: 'شهر را وارد کنید' })
  @MaxLength(60)
  city!: string;

  @Transform(text)
  @IsString()
  @MinLength(10, { message: 'نشانی باید کامل‌تر باشد' })
  @MaxLength(300)
  address!: string;

  @Transform(postal)
  @Matches(/^[1-9]\d{9}$/, { message: 'کد پستی باید ۱۰ رقم باشد' })
  postalCode!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}