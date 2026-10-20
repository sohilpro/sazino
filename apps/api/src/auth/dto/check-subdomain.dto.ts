import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

export class CheckSubdomainDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MaxLength(63)
  subdomain!: string;
}