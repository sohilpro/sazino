import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { Env } from '../config/env';
import { CacheInvalidationInterceptor } from './cache-invalidation.interceptor';
import { CACHE_OPTIONS, type CacheOptions } from './cache.options';
import { StorefrontCacheInterceptor } from './storefront-cache.interceptor';
import { StorefrontCacheService } from './storefront-cache.service';

@Global()
@Module({
  providers: [
    {
      provide: CACHE_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): CacheOptions => ({
        enabled: config.get('CACHE_ENABLED', { infer: true }),
        ttlSeconds: config.get('CACHE_TTL_SECONDS', { infer: true }),
      }),
    },
    StorefrontCacheService,
    { provide: APP_INTERCEPTOR, useClass: StorefrontCacheInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CacheInvalidationInterceptor },
  ],
  exports: [StorefrontCacheService, CACHE_OPTIONS],
})
export class CacheModule {}