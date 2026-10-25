import { IsString, Matches } from 'class-validator';

export class PaymentCallbackDto {
  /** Authority زرین‌پال: حروف و عدد، ۳۶ کاراکتر */
  @IsString()
  @Matches(/^[A-Za-z0-9]{10,64}$/, { message: 'شناسه‌ی پرداخت نامعتبر است' })
  authority!: string;

  /** OK یا NOK؛ هر مقدار دیگری ناموفق حساب می‌شود */
  @IsString()
  @Matches(/^[A-Za-z]{1,10}$/)
  status!: string;
}