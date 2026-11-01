import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { MAINTENANCE_JOB, MAINTENANCE_QUEUE } from './maintenance.constants';
import { MaintenanceService } from './maintenance.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case MAINTENANCE_JOB.EXPIRE_ORDERS: {
        const expired = await this.maintenance.expireOrders();
        if (expired > 0) this.logger.log(`expire-orders: ${expired} order(s) canceled`);
        return { expired };
      }
      case MAINTENANCE_JOB.RECONCILE_PAYMENTS: {
        const result = await this.maintenance.reconcilePayments();
        if (result.checked > 0) {
          this.logger.log(`reconcile-payments: checked ${result.checked}, paid ${result.paid}`);
        }
        return result;
      }
      case MAINTENANCE_JOB.CLEANUP: {
        const result = await this.maintenance.cleanup();
        this.logger.log(`cleanup: ${JSON.stringify(result)}`);
        return result;
      }
      case MAINTENANCE_JOB.REVALIDATE_DOMAINS: {
        if (this.config.get('DOMAIN_REVALIDATE', { infer: true }) !== 'true')
          return { skipped: true };
        const result = await this.maintenance.revalidateDomains();
        if (result.disabled > 0)
          this.logger.warn(`revalidate-domains: ${result.disabled} domain(s) disabled`);
        return result;
      }
      default:
        this.logger.warn(`Unknown maintenance job "${job.name}"`);
        return null;
    }
  }
}
