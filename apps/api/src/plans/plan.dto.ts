import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type PipeTransform,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { TenantPlan } from '@myapp/shared-types';
import { trim } from '../common/transforms';
import { isPlanKey } from './plan-defaults';

/** null = نامحدود، عدد = سقف، نبودن = بدون تغییر */
export class UpdatePlanDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  maxProducts?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000)
  maxDomains?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  maxMediaMb?: number | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  priceMonthly?: number;
}

@Injectable()
export class PlanKeyPipe implements PipeTransform<string, TenantPlan> {
  transform(value: string): TenantPlan {
    const key = value.trim().toUpperCase();
    if (!isPlanKey(key)) throw new NotFoundException('پلن پیدا نشد');
    return key;
  }
}

export function assertPlanKey(value: unknown): TenantPlan {
  if (!isPlanKey(value)) throw new BadRequestException('پلن نامعتبر است');
  return value;
}
