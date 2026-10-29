import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { NotificationsHandler } from './notifications.handler';
import { NOTIFICATIONS_QUEUE, type NotificationJob } from './notifications.constants';

@Processor(NOTIFICATIONS_QUEUE, { concurrency: 5 })
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly handler: NotificationsHandler) {
    super();
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    await this.handler.handle(job.name, job.data);
  }
}