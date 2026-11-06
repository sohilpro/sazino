import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, mergeMap, of } from 'rxjs';
import { TenantContext } from '../tenants/tenant-context';
import { buildCacheKey } from './cache-key';
import { StorefrontCacheService } from './storefront-cache.service';

@Injectable()
export class StorefrontCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: StorefrontCacheService,
    private readonly ctx: TenantContext,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (!this.cache.enabled || context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    if (req.method !== 'GET' || req.headers.authorization) return next.handle();

    let tenantId: string;
    try {
      tenantId = this.ctx.require();
    } catch {
      return next.handle();
    }

    const version = await this.cache.currentVersion(tenantId);
    if (version === null) return next.handle();

    const key = buildCacheKey({ tenantId, version, path: req.path, query: req.query });
    if (key === null) return next.handle();

    const hit = await this.cache.read(key);
    if (hit !== null) {
      try {
        const body: unknown = JSON.parse(hit);
        res.setHeader('X-Cache', 'HIT');
        return of(body);
      } catch {
        /* ورودی خراب؛ مثل miss رفتار کن */
      }
    }

    res.setHeader('X-Cache', 'MISS');
    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        if (res.statusCode === 200 && body !== null && typeof body === 'object') {
          await this.cache.write(key, JSON.stringify(body));
        }
        return body;
      }),
    );
  }
}