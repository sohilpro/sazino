import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { PlatformAdmin } from '../generated/prisma/client';
import { AdminAuthService } from './admin-auth.service';
import { ADMIN_COOKIE } from './admin.constants';

export type RequestWithAdmin = Request & { admin?: PlatformAdmin };

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithAdmin>();
    const cookie = (req.cookies as Record<string, unknown> | undefined)?.[ADMIN_COOKIE];
    const admin = await this.auth.resolve(typeof cookie === 'string' ? cookie : undefined);
    if (!admin) throw new UnauthorizedException('نشست مدیر پلتفرم معتبر نیست');
    req.admin = admin;
    return true;
  }
}

export interface AdminActor {
  id: string;
  email: string;
  ip?: string;
}

/** ادمین واردشده و IP درخواست */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminActor => {
    const req = ctx.switchToHttp().getRequest<RequestWithAdmin>();
    return { id: req.admin!.id, email: req.admin!.email, ip: req.ip };
  },
);
