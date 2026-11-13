import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { StoreSettingsController } from './store-settings.controller';
import { StoreSettingsService } from './store-settings.service';
import { createTenantClient } from './tenant-client';
import { TENANT_DB } from './tenant-db';
import { TenantContext } from './tenant-context';
import { TenantMiddleware } from './tenant.middleware';
import { TenantResolver } from './tenant-resolver';
import { StoreUrlService } from './store-url.service';
import { TenantStatusService } from './tenant-status.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Global()
@Module({
  controllers: [StoreController, StoreSettingsController],
  providers: [
    TenantContext,
    TenantResolver,
    StoreService,
    StoreSettingsService,
    StoreUrlService,
    TenantStatusService,
    {
      provide: TENANT_DB,
      inject: [TenantPrismaService, TenantContext],
      useFactory: (prisma: TenantPrismaService, ctx: TenantContext) =>
        createTenantClient(prisma, ctx, { rls: prisma.rls }),
    },
  ],
  exports: [TenantContext, TenantResolver, TENANT_DB, StoreUrlService, TenantStatusService],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
