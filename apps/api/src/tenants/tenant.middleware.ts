import { ForbiddenException, Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { firstHeader } from './host';
import { TenantContext } from './tenant-context';
import { TenantResolver } from './tenant-resolver';
import type { TenantStore } from './tenant.types';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly resolver: TenantResolver,
    private readonly ctx: TenantContext,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // ترتیب: هدر صریح (Nuxt SSR) ← x-forwarded-host (پروکسی) ← Host
    const explicit = firstHeader(req.headers['x-tenant-host']);
    const raw = explicit ?? firstHeader(req.headers['x-forwarded-host']) ?? req.headers.host;

    const resolution = await this.resolver.resolve(raw, { explicit: Boolean(explicit) });

    const store: TenantStore = {};
    if (resolution.type === 'not_found') throw new NotFoundException('فروشگاه پیدا نشد');
    if (resolution.type === 'tenant') {
      if (resolution.tenant.status !== 'ACTIVE') {
        throw new ForbiddenException('این فروشگاه موقتاً غیرفعال است');
      }
      store.tenant = resolution.tenant;
      store.tenantId = resolution.tenant.id;
      store.source = 'host';
    }

    // بقیه‌ی زنجیره‌ی درخواست (Guards، Controller، ...) داخل این context اجرا می‌شود
    this.ctx.run(store, () => next()).catch(next);
  }
}