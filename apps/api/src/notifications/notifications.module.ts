import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JOBS_ENABLED } from '../jobs/jobs-flag';
import { NOTIFICATIONS_QUEUE } from './notifications.constants';
import { NotificationsHandler } from './notifications.handler';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  providers: [
    NotificationsService,
    NotificationsHandler,
    // بدون processor هیچ worker ساخته نمی‌شود (تست‌ها)
    ...(JOBS_ENABLED ? [NotificationsProcessor] : []),
  ],
  exports: [NotificationsService, NotificationsHandler],
})
export class NotificationsModule {}