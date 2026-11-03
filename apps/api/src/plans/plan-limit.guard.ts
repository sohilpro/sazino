import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanLimitsService, type CountedResource } from './plan-limits.service';

export const PLAN_LIMIT_KEY = 'planLimit';

/** قبل از اجرای این route سقف پلن برای ساخت مورد جدید بررسی می‌شود */
export const PlanLimit = (resource: CountedResource) => SetMetadata(PLAN_LIMIT_KEY, resource);

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limits: PlanLimitsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<CountedResource | undefined>(PLAN_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (resource) await this.limits.assertCanCreate(resource);
    return true;
  }
}