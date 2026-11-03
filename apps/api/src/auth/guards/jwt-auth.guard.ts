import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { TenantContext } from '../../tenants/tenant-context';
import { TenantStatusService } from '../../tenants/tenant-status.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload, RequestUser } from '../types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContext,
    private readonly tenantStatus: TenantStatusService,
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

    // فروشگاه تعلیق‌شده: توکن‌های هنوز معتبر هم بلافاصله رد می‌شوند
    const status = await this.tenantStatus.get(payload.tenantId);
    if (status === null) throw new UnauthorizedException('توکن نامعتبر یا منقضی است');
    if (status === 'SUSPENDED') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'TENANT_SUSPENDED',
        message: 'فروشگاه شما تعلیق شده است',
      });
    }

    // اگر درخواست روی Host فروشگاه دیگری آمده باشد، 403
    this.tenantContext.bindAuthTenant(payload.tenantId);

    req.user = { id: payload.sub, tenantId: payload.tenantId, role: payload.role };
    return true;
  }
}