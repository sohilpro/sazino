import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_TENANT_KEY } from './require-tenant.decorator';
import { TenantContext } from './tenant-context';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ctx: TenantContext,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && !this.ctx.tenantId) throw new NotFoundException('فروشگاه مشخص نشده است');
    return true;
  }
}