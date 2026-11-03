import { HttpException, Injectable, Logger } from '@nestjs/common';
import { CANCEL_REASON } from '../orders/orders.constants';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenants/tenant-context';
import { DomainsService } from '../domains/domains.service';
import { PENDING_DOMAIN_TTL_MS } from '../domains/domains.constants';
import {
  DAY_MS,
  GUEST_CART_TTL_MS,
  RECONCILE_MAX_AGE_MS,
  RECONCILE_MIN_AGE_MS,
} from './maintenance.constants';

interface Scope {
  /** فقط برای تست یا اجرای دستی روی یک فروشگاه */
  tenantId?: string;
  limit?: number;
}

/**
 * کارهای سراسری (روی همه‌ی فروشگاه‌ها). از PrismaService بدون فیلتر می‌خواند،
 * ولی هر تغییر داخل context همان فروشگاه و با سرویس‌های عادی انجام می‌شود.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly domains: DomainsService,
  ) {}

  /** سفارش‌های پرداخت‌نشده‌ی منقضی را لغو و موجودی را آزاد می‌کند */
  async expireOrders(scope: Scope = {}): Promise<number> {
    const stale = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
        ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
      },
      select: { id: true, tenantId: true },
      orderBy: { expiresAt: 'asc' },
      take: scope.limit ?? 200,
    });

    let expired = 0;
    for (const order of stale) {
      try {
        await this.ctx.runAs(order.tenantId, () =>
          this.orders.transition(order.id, 'CANCELED', { reason: CANCEL_REASON.EXPIRED }),
        );
        expired++;
      } catch (err) {
        // رقابت (پرداخت یا لغو هم‌زمان) خطا نیست
        if (!(err instanceof HttpException)) {
          this.logger.warn(`Could not expire order ${order.id}: ${(err as Error).message}`);
        }
      }
    }
    return expired;
  }

  /**
   * مشتری‌ای که بعد از پرداخت به سایت برنگشته: پرداخت دوباره با درگاه بررسی می‌شود.
   * (همان مسیر callback؛ idempotent است و پرداخت‌نشده‌ها را FAILED می‌کند)
   */
  async reconcilePayments(scope: Scope = {}): Promise<{ checked: number; paid: number }> {
    const now = Date.now();
    const candidates = await this.prisma.payment.findMany({
      where: {
        provider: 'ZARINPAL',
        createdAt: {
          gt: new Date(now - RECONCILE_MAX_AGE_MS),
          lt: new Date(now - RECONCILE_MIN_AGE_MS),
        },
        // لغو توسط کاربر در بانک (علت دیگر) دوباره بررسی نمی‌شود
        OR: [{ status: 'INITIATED' }, { status: 'FAILED', failureReason: 'VERIFY_REJECTED' }],
        order: { is: { status: 'PENDING' } },
        ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
      },
      select: { authority: true, tenantId: true },
      orderBy: { createdAt: 'asc' },
      take: scope.limit ?? 100,
    });

    let paid = 0;
    for (const payment of candidates) {
      try {
        const result = await this.ctx.runAs(payment.tenantId, () =>
          this.payments.handleCallback(payment.authority, 'OK'),
        );
        if (result.outcome === 'PAID') paid++;
      } catch (err) {
        this.logger.warn(`Reconcile failed for a payment: ${(err as Error).message}`);
      }
    }
    return { checked: candidates.length, paid };
  }

  /** مالکیت دامنه‌های تأییدشده را دوباره می‌بیند؛ ۳ شکست پشت‌سرهم = غیرفعال‌شدن و آزادشدن دامنه */
  async revalidateDomains(scope: Scope = {}): Promise<{ checked: number; disabled: number }> {
    const cutoff = new Date(Date.now() - DAY_MS);
    const rows = await this.prisma.domain.findMany({
      where: {
        status: 'VERIFIED',
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: cutoff } }],
        ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
      },
      select: { id: true, tenantId: true },
      orderBy: { lastCheckedAt: { sort: 'asc', nulls: 'first' } },
      take: scope.limit ?? 200,
    });

    let disabled = 0;
    for (const row of rows) {
      try {
        const result = await this.ctx.runAs(row.tenantId, () => this.domains.revalidate(row.id));
        if (result === 'disabled') disabled++;
      } catch (err) {
        this.logger.warn(`Domain revalidation failed: ${(err as Error).message}`);
      }
    }
    return { checked: rows.length, disabled };
  }

  /** پاکسازی داده‌های منقضی؛ روزانه */
  async cleanup(): Promise<{
    sessions: number;
    refreshTokens: number;
    guestCarts: number;
    pendingDomains: number;
    adminSessions: number;
  }> {
    const now = Date.now();

    const sessions = await this.prisma.customerSession.deleteMany({
      where: { expiresAt: { lt: new Date(now) } },
    });

    // رمز تازه‌ی ابطال‌شده می‌ماند تا استفاده‌ی دوباره‌ی آن (سرقت) قابل تشخیص باشد؛ فقط منقضی‌های قدیمی پاک می‌شوند
    const refreshTokens = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date(now - DAY_MS) } },
    });

    // سبد مهمانی که ۳۰ روز است ساخته شده و هیچ آیتمش تازه نیست
    const cutoff = new Date(now - GUEST_CART_TTL_MS);
    const guestCarts = await this.prisma.cart.deleteMany({
      where: {
        customerId: null,
        createdAt: { lt: cutoff },
        items: { none: { updatedAt: { gte: cutoff } } },
      },
    });

    // دامنه‌ای که ۱۴ روز در انتظار مانده، رها شده است
    const pendingDomains = await this.prisma.domain.deleteMany({
      where: { status: 'PENDING', createdAt: { lt: new Date(now - PENDING_DOMAIN_TTL_MS) } },
    });

    const adminSessions = await this.prisma.adminSession.deleteMany({
      where: { expiresAt: { lt: new Date(now) } },
    });

    return {
      sessions: sessions.count,
      refreshTokens: refreshTokens.count,
      guestCarts: guestCarts.count,
      pendingDomains: pendingDomains.count,
      adminSessions: adminSessions.count,
    };
  }
}
