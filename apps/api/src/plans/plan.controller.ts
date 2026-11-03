import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PlanUsageDto } from '@myapp/shared-types';
import { PlanLimitsService } from './plan-limits.service';

@ApiTags('plan')
@ApiBearerAuth()
@Controller('plan')
export class PlanController {
  constructor(private readonly limits: PlanLimitsService) {}

  /** پلن فعلی، سقف‌ها و مصرف؛ برای همه‌ی نقش‌ها */
  @Get()
  get(): Promise<PlanUsageDto> {
    return this.limits.snapshot();
  }
}