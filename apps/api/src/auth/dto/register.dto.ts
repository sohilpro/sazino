import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SUBDOMAIN_REGEX } from '../../tenants/subdomain';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  storeName!: string;

  @Transform(trimLower)
  @Matches(SUBDOMAIN_REGEX, {
    message: 'ساب‌دامین باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد',
  })
  subdomain!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}