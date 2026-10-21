import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { TenantContext } from '../../tenants/tenant-context';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload, RequestUser } from '../types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('توکن ارسال نشده است');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('توکن نامعتبر یا منقضی است');
    }

    // اگر درخواست روی Host فروشگاه دیگری آمده باشد، 403
    this.tenantContext.bindAuthTenant(payload.tenantId);

    req.user = { id: payload.sub, tenantId: payload.tenantId, role: payload.role };
    return true;
  }
}