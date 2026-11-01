import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JOBS_ENABLED } from '../jobs/jobs-flag';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { MAINTENANCE_QUEUE } from './maintenance.constants';
import { MaintenanceProcessor } from './maintenance.processor';
import { MaintenanceScheduler } from './maintenance.scheduler';
import { MaintenanceService } from './maintenance.service';
import { DomainsModule } from '../domains/domains.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: MAINTENANCE_QUEUE }),
    OrdersModule,
    PaymentsModule,
    DomainsModule,
  ],
  providers: [
    MaintenanceService,
    ...(JOBS_ENABLED ? [MaintenanceProcessor, MaintenanceScheduler] : []),
  ],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
