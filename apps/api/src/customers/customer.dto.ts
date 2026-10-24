import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { normalizeDigits, normalizePhone, PHONE_REGEX } from '../common/phone';
import { trim } from '../common/transforms';
import { MAX_LINE_QUANTITY, OTP } from './customers.constants';

const phoneTransform = ({ value }: { value: unknown }) => normalizePhone(value) ?? value;

export class RequestOtpDto {
  @Transform(phoneTransform)
  @Matches(PHONE_REGEX, { message: 'شماره‌ی موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)' })
  phone!: string;
}

export class VerifyOtpDto {
  @Transform(phoneTransform)
  @Matches(PHONE_REGEX, { message: 'شماره‌ی موبایل معتبر نیست' })
  phone!: string;

  @Transform(({ value }) => (typeof value === 'string' ? normalizeDigits(value).trim() : value))
  @Matches(new RegExp(`^\\d{${OTP.LENGTH}}$`), { message: `کد تأیید ${OTP.LENGTH} رقمی است` })
  code!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'نام باید حداقل ۲ کاراکتر باشد' })
  @MaxLength(60)
  name?: string;
}

export class AddCartItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}

export class SetCartItemDto {
  /** ۰ یعنی حذف از سبد */
  @IsInt()
  @Min(0)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}