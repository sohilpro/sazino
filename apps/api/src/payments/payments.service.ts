import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PaymentOutcomeDto, StartPaymentResponse } from '@myapp/shared-types';
import { conflict } from '../common/errors';
import type { Customer } from '../generated/prisma/client';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { PaymentGatewayService } from './payment-gateway.service';
import {
  MAX_ORDER_LIFETIME_MINUTES,
  MAX_PAYMENT_ATTEMPTS,
  MIN_ONLINE_PAYMENT,
  PAYMENT_HOLD_MINUTES,
  PAYMENT_PROVIDER,
  VERIFY_TX_OPTIONS,
} from './payments.constants';
import {
  GatewayUnavailableError,
  ZARINPAL_API,
  type ZarinpalApi,
} from './gateway/zarinpal.types';

const MAX_INT = 2_147_483_647;

/** درگاه صراحتاً پرداخت را تأیید نکرد (باعث rollback تراکنش تأیید می‌شود) */
class VerifyRejected extends Error {
  constructor(
    readonly code: number,
    detail: string,
  ) {
    super(detail);
  }
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly gateways: PaymentGatewayService,
    @Inject(ZARINPAL_API) private readonly api: ZarinpalApi,
  ) {}

  // ───────────── شروع پرداخت ─────────────
  async start(
    customer: Customer,
    orderNumber: number,
    callbackOrigin: string,
  ): Promise<StartPaymentResponse> {
    const tenantId = this.ctx.require();
    if (!Number.isInteger(orderNumber) || orderNumber < 1 || orderNumber > MAX_INT) {
      throw new NotFoundException('سفارش پیدا نشد');
    }

    const order = await this.db.order.findFirst({
      where: { customerId: customer.id, number: orderNumber },
      select: { id: true, number: true, status: true, total: true, createdAt: true, expiresAt: true },
    });
    if (!order) throw new NotFoundException('سفارش پیدا نشد');

    if (order.status !== 'PENDING') {
      throw conflict('NOT_PAYABLE', 'این سفارش در انتظار پرداخت نیست');
    }
    if (!order.expiresAt || order.expiresAt <= new Date()) {
      throw conflict('ORDER_EXPIRED', 'مهلت پرداخت این سفارش تمام شده است');
    }
    if (order.total < MIN_ONLINE_PAYMENT) {
      throw conflict('AMOUNT_TOO_LOW', 'مبلغ سفارش کمتر از حداقل پرداخت آنلاین است');
    }

    const attempts = await this.db.payment.count({ where: { orderId: order.id } });
    if (attempts >= MAX_PAYMENT_ATTEMPTS) {
      throw conflict('TOO_MANY_ATTEMPTS', 'تعداد تلاش‌های پرداخت این سفارش به سقف رسیده است');
    }

    const merchantId = await this.gateways.merchantId({ requireActive: true });
    if (!merchantId) {
      throw conflict('GATEWAY_NOT_CONFIGURED', 'پرداخت آنلاین این فروشگاه فعال نیست');
    }

    // موجودی تا پایان پرداخت نگه داشته می‌شود (با سقف عمر سفارش)
    const now = Date.now();
    const holdUntil = Math.min(
      Math.max(order.expiresAt.getTime(), now + PAYMENT_HOLD_MINUTES * 60_000),
      order.createdAt.getTime() + MAX_ORDER_LIFETIME_MINUTES * 60_000,
    );
    const held = await this.db.order.updateMany({
      where: { id: order.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date(holdUntil) },
    });
    if (held.count !== 1) {
      throw conflict('ORDER_EXPIRED', 'مهلت پرداخت این سفارش تمام شده است');
    }

    let result;
    try {
      result = await this.api.request({
        merchantId,
        amount: order.total,
        callbackUrl: `${callbackOrigin}/payment/callback`,
        description: `سفارش شماره ${order.number}`,
        mobile: customer.phone,
      });
    } catch (err) {
      this.logger.error(`Gateway request failed for order ${order.number}: ${(err as Error).message}`);
      throw new BadGatewayException('ارتباط با درگاه پرداخت برقرار نشد؛ کمی بعد دوباره تلاش کنید');
    }

    if (result.kind === 'rejected') {
      this.logger.error(`Gateway rejected order ${order.number}: code ${result.code}`);
      throw new BadGatewayException('درگاه پرداخت درخواست را نپذیرفت؛ فروشگاه را در جریان بگذارید');
    }

    await this.db.payment.create({
      data: {
        tenantId,
        orderId: order.id,
        provider: PAYMENT_PROVIDER,
        amount: order.total,
        authority: result.authority,
      },
    });

    return { paymentUrl: result.paymentUrl };
  }

  // ───────────── بازگشت از درگاه ─────────────
  async handleCallback(authority: string, status: string): Promise<PaymentOutcomeDto> {
    const payment = await this.db.payment.findFirst({
      where: { authority },
      include: { order: { select: { number: true } } },
    });
    if (!payment) throw new NotFoundException('پرداخت پیدا نشد');

    const orderNumber = payment.order.number;

    // callback تکراری: هیچ تماسی با درگاه لازم نیست
    if (payment.status === 'PAID') return { outcome: 'PAID', orderNumber };

    if (status !== 'OK') {
      // کاربر پرداخت را لغو کرد یا بانک ناموفق بود؛ پولی کسر نشده
      await this.db.payment.updateMany({
        where: { id: payment.id, status: 'INITIATED' },
        data: { status: 'FAILED', failureReason: 'CANCELED_OR_FAILED_AT_GATEWAY' },
      });
      return { outcome: 'FAILED', orderNumber };
    }

    return { outcome: await this.verify(payment), orderNumber };
  }

  /**
   * تأیید پرداخت با درگاه. تراکنش دیتابیس ردیف سفارش را قفل می‌کند:
   *   ۱) PENDING → PAID  (اگر نشد: سفارش دیگر قابل پرداخت نیست؛ verify اصلاً صدا زده نمی‌شود)
   *   ۲) verify با درگاه (موفق نبود → rollback و سفارش PENDING می‌ماند)
   * پس لغو یا انقضای هم‌زمان نمی‌تواند سفارشِ پول‌گرفته‌شده را CANCELED کند.
   */
  async verify(payment: {
    id: string;
    orderId: string;
    authority: string;
    amount: number;
  }): Promise<PaymentOutcomeDto['outcome']> {
    const merchantId = await this.gateways.merchantId({ requireActive: false });
    if (!merchantId) {
      this.logger.warn(`Cannot verify payment ${payment.id}: gateway is not configured`);
      return 'PENDING_CHECK';
    }

    try {
      const result = await this.db.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: payment.orderId, status: 'PENDING' },
          data: { status: 'PAID', paidAt: new Date(), expiresAt: null },
        });
        if (claimed.count !== 1) return 'NOT_PAYABLE' as const;

        const res = await this.api.verify({
          merchantId,
          authority: payment.authority,
          amount: payment.amount,
        });
        if (res.kind === 'rejected') throw new VerifyRejected(res.code, res.message);

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            refId: res.refId,
            cardPan: res.cardPan,
            gatewayCode: res.code,
            failureReason: null,
            verifiedAt: new Date(),
          },
        });
        return 'PAID' as const;
      }, VERIFY_TX_OPTIONS);

      if (result === 'PAID') return 'PAID';

      // سفارش PENDING نبود: یا همین پرداخت هم‌زمان تأیید شد، یا سفارش لغو/پرداخت شده است
      const fresh = await this.db.payment.findFirst({
        where: { id: payment.id },
        select: { status: true },
      });
      return fresh?.status === 'PAID' ? 'PAID' : 'NOT_PAYABLE';
    } catch (err) {
      if (err instanceof VerifyRejected) {
        // FAILED پایانی نیست: callback بعدی با Status=OK دوباره verify می‌کند
        await this.db.payment.updateMany({
          where: { id: payment.id, status: { not: 'PAID' } },
          data: { status: 'FAILED', gatewayCode: err.code, failureReason: 'VERIFY_REJECTED' },
        });
        return 'FAILED';
      }
      if (err instanceof GatewayUnavailableError) {
        this.logger.warn(`Verify of payment ${payment.id} is undetermined: ${err.message}`);
        return 'PENDING_CHECK';
      }
      this.logger.error(`Verify of payment ${payment.id} crashed: ${(err as Error).message}`);
      throw err;
    }
  }
}