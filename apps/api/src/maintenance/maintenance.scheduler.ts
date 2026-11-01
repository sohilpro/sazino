import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { MAINTENANCE_JOB, MAINTENANCE_QUEUE } from './maintenance.constants';

@Injectable()
export class MaintenanceScheduler implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceScheduler.name);

  constructor(@InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  /** upsert: با هر بار بالا آمدن API زمان‌بندی‌ها به‌روز می‌شوند و تکراری نمی‌سازند */
  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        MAINTENANCE_JOB.EXPIRE_ORDERS,
        { every: 5 * 60_000 },
        { name: MAINTENANCE_JOB.EXPIRE_ORDERS },
      );
      await this.queue.upsertJobScheduler(
        MAINTENANCE_JOB.RECONCILE_PAYMENTS,
        { every: 5 * 60_000 },
        { name: MAINTENANCE_JOB.RECONCILE_PAYMENTS },
      );
      await this.queue.upsertJobScheduler(
        MAINTENANCE_JOB.CLEANUP,
        { pattern: '0 3 * * *' },
        { name: MAINTENANCE_JOB.CLEANUP },
      );
      await this.queue.upsertJobScheduler(
        MAINTENANCE_JOB.REVALIDATE_DOMAINS,
        { pattern: '0 4 * * *' },
        { name: MAINTENANCE_JOB.REVALIDATE_DOMAINS },
      );
    } catch (err) {
      // نبودن Redis نباید API را از کار بیندازد
      this.logger.error(`Could not register job schedules: ${(err as Error).message}`);
    }
  }
}
