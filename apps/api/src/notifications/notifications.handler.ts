import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { NOTIFICATION_JOB, type NotificationJob } from './notifications.constants';
import { sellerPaidEmail } from './order-emails';

@Injectable()
export class NotificationsHandler {
  private readonly logger = new Logger(NotificationsHandler.name);
  private readonly dashboardUrl: string;

  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly sms: SmsService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.dashboardUrl = config.get('DASHBOARD_URL', { infer: true }).replace(/\/+$/, '');
  }

  /** خطای ارسال عمداً پرتاب می‌شود تا BullMQ دوباره تلاش کند؛ نبودن سفارش یا فروشگاه خطا نیست */
  handle(name: string, data: NotificationJob): Promise<void> {
    return this.ctx.runAs(data.tenantId, async () => {
      switch (name) {
        case NOTIFICATION_JOB.PAID_CUSTOMER_SMS:
          return this.paidCustomerSms(data.orderId);
        case NOTIFICATION_JOB.PAID_SELLER_EMAIL:
          return this.paidSellerEmail(data.orderId);
        case NOTIFICATION_JOB.SHIPPED_CUSTOMER_SMS:
          return this.shippedCustomerSms(data.orderId);
        default:
          this.logger.warn(`Unknown notification job "${name}"`);
      }
    });
  }

  private async paidCustomerSms(orderId: string): Promise<void> {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      select: { number: true, status: true, customer: { select: { phone: true } } },
    });
    if (!order || (order.status !== 'PAID' && order.status !== 'SHIPPED')) return;

    if (!this.sms.supports('order')) {
      this.logger.warn('SMS pattern "order" is not configured; customer notification skipped');
      return;
    }
    await this.sms.sendOrder(order.customer.phone, String(order.number));
  }

  private async shippedCustomerSms(orderId: string): Promise<void> {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      select: {
        number: true,
        status: true,
        trackingCode: true,
        customer: { select: { phone: true } },
      },
    });
    if (!order || order.status !== 'SHIPPED') return;

    if (!this.sms.supports('shipped')) {
      this.logger.warn('SMS pattern "shipped" is not configured; customer notification skipped');
      return;
    }
    await this.sms.send('shipped', order.customer.phone, [String(order.number), order.trackingCode ?? '-']);
  }

  private async paidSellerEmail(orderId: string): Promise<void> {
    if (!this.mail.enabled) return;

    const order = await this.db.order.findUnique({
      where: { id: orderId },
      select: {
        number: true,
        status: true,
        total: true,
        recipientName: true,
        recipientPhone: true,
        items: {
          select: { productTitle: true, variantTitle: true, quantity: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!order || (order.status !== 'PAID' && order.status !== 'SHIPPED')) return;

    const [tenant, staff] = await Promise.all([
      this.db.tenant.findUnique({ where: { id: this.ctx.require() }, select: { name: true } }),
      this.db.user.findMany({
        where: { role: { in: ['OWNER', 'ADMIN'] }, isActive: true },
        select: { email: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    if (!tenant || staff.length === 0) return;

    const email = sellerPaidEmail({
      storeName: tenant.name,
      orderNumber: order.number,
      total: order.total,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      items: order.items.map((i) => ({
        title: i.productTitle,
        variant: i.variantTitle,
        quantity: i.quantity,
      })),
      orderUrl: `${this.dashboardUrl}/orders/${order.number}`,
    });

    // یک ایمیل با چند گیرنده: خطا یعنی هیچ‌کس نگرفته و تلاش مجدد دوبار نمی‌فرستد
    await this.mail.send({ to: staff.map((u) => u.email), ...email });
  }
}