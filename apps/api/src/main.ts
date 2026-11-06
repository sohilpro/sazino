import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './common/cors';
import { applySecurity } from './common/security';
import type { Env } from './config/env';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const production = config.get('NODE_ENV', { infer: true }) === 'production';

  // IP واقعی بازدیدکننده، توکن پروکسی، Helmet و CORS (باید اولین middlewareها باشند)
  applySecurity(app, {
    production,
    trustProxyHops: config.get('TRUST_PROXY_HOPS', { infer: true }),
    requireProxyToken: config.get('REQUIRE_PROXY_TOKEN', { infer: true }),
    internalToken: config.get('INTERNAL_API_TOKEN', { infer: true }) ?? '',
    corsOrigins: parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true }), { production }),
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  if (!production) {
    const doc = new DocumentBuilder()
      .setTitle('MyApp API')
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`API:  http://localhost:${port}/api/health`);
  new Logger('Bootstrap').log(`Docs: http://localhost:${port}/docs`);
}

void bootstrap();