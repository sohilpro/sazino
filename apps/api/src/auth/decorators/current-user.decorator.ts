import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../types';

export const CurrentUser = createParamDecorator(
  (field: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const user = (ctx.switchToHttp().getRequest<Request>() as Request & { user: RequestUser })
      .user;
    return field ? user?.[field] : user;
  },
);