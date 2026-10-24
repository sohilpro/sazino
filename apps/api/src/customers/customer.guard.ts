import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Customer } from '../generated/prisma/client';
import { CustomerSessionService } from './customer-session.service';
import { readCookie } from './cookies';
import { SESSION_COOKIE } from './customers.constants';

export type RequestWithCustomer = Request & { customer?: Customer };

@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(private readonly sessions: CustomerSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithCustomer>();
    const customer = await this.sessions.resolve(readCookie(req, SESSION_COOKIE));
    if (!customer) throw new UnauthorizedException('برای ادامه وارد حساب خود شوید');
    req.customer = customer;
    return true;
  }
}

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Customer | undefined =>
    ctx.switchToHttp().getRequest<RequestWithCustomer>().customer,
);