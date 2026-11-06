import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, mergeMap } from 'rxjs';
import { StorefrontCacheService } from './storefront-cache.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** هر نوشتن موفق فروشنده (JWT دارای tenantId) کش ویترین همان فروشگاه را باطل می‌کند. */
@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  constructor(private readonly cache: StorefrontCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request & { user?: { tenantId?: string } }>();
    if (!WRITE_METHODS.has(req.method)) return next.handle();

    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        const tenantId = req.user?.tenantId;
        if (typeof tenantId === 'string') await this.cache.invalidate(tenantId);
        return body;
      }),
    );
  }
}