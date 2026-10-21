import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoreController } from './store.controller';
import { createTenantClient } from './tenant-client';
import { TENANT_DB } from './tenant-db';
import { TenantContext } from './tenant-context';
import { TenantMiddleware } from './tenant.middleware';
import { TenantResolver } from './tenant-resolver';

@Global()
@Module({
  controllers: [StoreController],
  providers: [
    TenantContext,
    TenantResolver,
    {
      provide: TENANT_DB,
      inject: [PrismaService, TenantContext],
      useFactory: (prisma: PrismaService, ctx: TenantContext) => createTenantClient(prisma, ctx),
    },
  ],
  exports: [TenantContext, TenantResolver, TENANT_DB],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}