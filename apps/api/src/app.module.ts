import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { SmsModule } from './sms/sms.module';
import { TenantsModule } from './tenants/tenants.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { MediaModule } from './media/media.module';
import { CustomersModule } from './customers/customers.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { TenantGuard } from './tenants/tenant.guard';
import { AppExceptionFilter } from './common/filters/app-exception.filter';
import { OrdersModule } from './orders/orders.module';
import { CryptoModule } from './crypto/crypto.module';
import { PaymentsModule } from './payments/payments.module';
import { BullModule } from '@nestjs/bullmq';
import { MailModule } from './mail/mail.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DEFAULT_JOB_OPTIONS, redisConnection } from './jobs/queue.config';
import type { Env } from './config/env';
import { PagesModule } from './pages/pages.module';
import { DomainsModule } from './domains/domains.module';
import { PlansModule } from './plans/plans.module';
import { AdminModule } from './admin/admin.module';
import { PlanLimitGuard } from './plans/plan-limit.guard';
import { CacheModule } from './cache/cache.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { SeoModule } from './seo/seo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: redisConnection(config.get('REDIS_URL', { infer: true })),
        prefix: config.get('QUEUE_PREFIX', { infer: true }),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
    MailModule,
    MaintenanceModule,
    NotificationsModule,
    DatabaseModule,
    RedisModule,
    PrismaModule,
    StorageModule,
    SmsModule,
    TenantsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    MediaModule,
    CustomersModule,
    OrdersModule,
    CryptoModule,
    PaymentsModule,
    PagesModule,
    DomainsModule,
    AdminModule,
    PlansModule,
    CacheModule,
    RateLimitModule,
    SeoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PlanLimitGuard },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
