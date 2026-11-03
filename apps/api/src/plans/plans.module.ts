import { Global, Module } from '@nestjs/common';
import { PlanLimitGuard } from './plan-limit.guard';
import { PlanLimitsService } from './plan-limits.service';
import { PlanController } from './plan.controller';
import { PlansService } from './plans.service';

@Global()
@Module({
  controllers: [PlanController],
  providers: [PlansService, PlanLimitsService, PlanLimitGuard],
  exports: [PlansService, PlanLimitsService, PlanLimitGuard],
})
export class PlansModule {}