import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../common/transforms';

export class AddDomainDto {
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'نام دامنه را وارد کنید' })
  @MaxLength(300)
  hostname!: string;
}