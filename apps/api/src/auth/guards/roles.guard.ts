import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@myapp/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestUser } from '../types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('دسترسی کافی ندارید');
    }
    return true;
  }
}