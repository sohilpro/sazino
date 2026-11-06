import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet, { type HelmetOptions } from 'helmet';
import { corsOriginCallback } from './cors';
import { createProxyHeaderGuard } from './proxy-header-guard';

export interface SecurityOptions {
  production: boolean;
  trustProxyHops: number;
  requireProxyToken: boolean;
  internalToken: string;
  corsOrigins: string[];
}

export function helmetOptions(production: boolean): HelmetOptions {
  return {
    // API فقط JSON می‌دهد؛ در پروداکشن همه‌چیز بسته است. در توسعه Swagger به CSP باز نیاز دارد.
    contentSecurityPolicy: production
      ? {
          useDefaults: false,
          directives: {
            defaultSrc: ["'none'"],
            baseUri: ["'none'"],
            formAction: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
  };
}

/** باید بلافاصله بعد از NestFactory.create صدا زده شود (قبل از هر middleware دیگر) */
export function applySecurity(app: NestExpressApplication, opts: SecurityOptions): void {
  if (opts.trustProxyHops > 0) app.set('trust proxy', opts.trustProxyHops);
  app.use(createProxyHeaderGuard({ required: opts.requireProxyToken, token: opts.internalToken }));
  app.use(helmet(helmetOptions(opts.production)));
  app.enableCors({
    origin: corsOriginCallback(opts.corsOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
}