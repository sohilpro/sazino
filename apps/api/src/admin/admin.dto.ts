import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { TenantPlan, TenantStatus } from '@myapp/shared-types';
import { PaginationQueryDto } from '../common/pagination';
import { trim, trimLower } from '../common/transforms';
import { PLAN_KEYS } from '../plans/plan-defaults';

export class AdminLoginDto {
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class AdminTenantListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: TenantStatus;

  @IsOptional()
  @IsIn(PLAN_KEYS)
  plan?: TenantPlan;

  /** نام فروشگاه، ساب‌دامین یا ایمیل مالک */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class SuspendTenantDto {
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'دلیل تعلیق را بنویسید (حداقل ۳ کاراکتر)' })
  @MaxLength(300)
  reason!: string;
}

export class SetTenantPlanDto {
  @IsIn(PLAN_KEYS)
  plan!: TenantPlan;
}