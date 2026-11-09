import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './common/cors';
import { JsonLogger } from './common/logging/json-logger';
import { createRequestLogger } from './common/logging/request-log';
import { applySecurity } from './common/security';
import { initSentry } from './common/sentry';
import type { Env } from './config/env';

async function bootstrap() {
  const production = process.env.NODE_ENV === 'production';
  // در پروداکشن لاگ JSON؛ در توسعه لاگ رنگی پیش‌فرض Nest
  const json = new JsonLogger(process.env.LOG_LEVEL);
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    production ? { logger: json } : undefined,
  );
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  initSentry({
    dsn: config.get('SENTRY_DSN', { infer: true }),
    environment: config.get('NODE_ENV', { infer: true }),
    release: config.get('GIT_SHA', { infer: true }),
  });

  // IP واقعی بازدیدکننده، توکن پروکسی، Helmet و CORS (باید اولین middlewareها باشند)
  applySecurity(app, {
    production,
    trustProxyHops: config.get('TRUST_PROXY_HOPS', { infer: true }),
    requireProxyToken: config.get('REQUIRE_PROXY_TOKEN', { infer: true }),
    internalToken: config.get('INTERNAL_API_TOKEN', { infer: true }) ?? '',
    corsOrigins: parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true }), { production }),
  });

  if (production) {
    app.use(createRequestLogger(json, { skip: (path) => path.startsWith('/api/health') }));
  }

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  if (!production) {
    const doc = new DocumentBuilder().setTitle('MyApp API').setVersion('0.1').addBearerAuth().build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`API:  http://localhost:${port}/api/health`);
  new Logger('Bootstrap').log(`Docs: http://localhost:${port}/docs`);
}

void bootstrap();