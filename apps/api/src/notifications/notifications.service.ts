import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  NOTIFICATION_JOB,
  NOTIFICATIONS_QUEUE,
  type NotificationJob,
} from './notifications.constants';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<NotificationJob>) {}

  orderPaid(tenantId: string, orderId: string): Promise<void> {
    return this.enqueue(
      [NOTIFICATION_JOB.PAID_CUSTOMER_SMS, NOTIFICATION_JOB.PAID_SELLER_EMAIL],
      tenantId,
      orderId,
    );
  }

  orderShipped(tenantId: string, orderId: string): Promise<void> {
    return this.enqueue([NOTIFICATION_JOB.SHIPPED_CUSTOMER_SMS], tenantId, orderId);
  }

  /**
   * jobId ثابت: افزودن دوباره‌ی همان job نادیده گرفته می‌شود (callback تکراری، job تطبیق).
   * خطای صف هرگز به کارِ اصلی (پرداخت، ارسال) سرایت نمی‌کند.
   */
  private async enqueue(names: string[], tenantId: string, orderId: string): Promise<void> {
    try {
      await Promise.all(
        names.map((name) => this.queue.add(name, { tenantId, orderId }, { jobId: `${name}-${orderId}` })),
      );
    } catch (err) {
      this.logger.error(`Could not enqueue ${names.join(', ')} for order ${orderId}: ${(err as Error).message}`);
    }
  }
}