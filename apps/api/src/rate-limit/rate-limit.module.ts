import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { RATE_LIMIT_OPTIONS, type RateLimitOptions } from './rate-limit.options';

/** فقط options را فراهم می‌کند؛ خود guard در AppModule ثبت می‌شود تا ترتیبش بین Throttler و JWT ثابت بماند */
@Global()
@Module({
  providers: [
    {
      provide: RATE_LIMIT_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): RateLimitOptions => ({
        enabled: config.get('RATE_LIMIT_ENABLED', { infer: true }),
        ipPerMin: config.get('RATE_LIMIT_IP_PER_MIN', { infer: true }),
        tenantPerMin: config.get('RATE_LIMIT_TENANT_PER_MIN', { infer: true }),
      }),
    },
  ],
  exports: [RATE_LIMIT_OPTIONS],
})
export class RateLimitModule {}