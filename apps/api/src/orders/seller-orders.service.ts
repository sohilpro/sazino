import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Paginated,
  SellerOrderDto,
  SellerOrderStats,
  SellerOrderSummaryDto,
  SellerPaymentDto,
} from '@myapp/shared-types';
import { conflict } from '../common/errors';
import { buildMeta } from '../common/pagination';
import { normalizeDigits } from '../common/phone';
import { normalizePersian } from '../common/persian';
import type { Payment, Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import type { SellerOrderListQueryDto } from './seller-order.dto';
import { CANCEL_REASON } from './orders.constants';
import { OrdersService, orderInclude } from './orders.service';

const MAX_INT = 2_147_483_647;

const toPaymentDto = (p: Payment): SellerPaymentDto => ({
  id: p.id,
  provider: p.provider,
  status: p.status,
  amount: p.amount,
  refId: p.refId,
  cardPan: p.cardPan,
  gatewayCode: p.gatewayCode,
  createdAt: p.createdAt.toISOString(),
  verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
});

@Injectable()
export class SellerOrdersService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────── خواندن ─────────────
  async list(q: SellerOrderListQueryDto): Promise<Paginated<SellerOrderSummaryDto>> {
    const where: Prisma.OrderWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...this.searchFilter(q.q),
    };

    const [rows, total] = await Promise.all([
      this.db.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          recipientName: true,
          createdAt: true,
          paidAt: true,
          customer: { select: { phone: true } },
          items: { select: { quantity: true } },
        },
      }),
      this.db.order.count({ where }),
    ]);

    return {
      items: rows.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        total: o.total,
        itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
        customerPhone: o.customer.phone,
        recipientName: o.recipientName,
        createdAt: o.createdAt.toISOString(),
        paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      })),
      meta: buildMeta(q.page, q.limit, total),
    };
  }

  async stats(): Promise<SellerOrderStats> {
    const [PENDING, PAID, SHIPPED, CANCELED] = await Promise.all(
      (['PENDING', 'PAID', 'SHIPPED', 'CANCELED'] as const).map((status) =>
        this.db.order.count({ where: { status } }),
      ),
    );
    return { PENDING: PENDING!, PAID: PAID!, SHIPPED: SHIPPED!, CANCELED: CANCELED! };
  }

  async get(number: number): Promise<SellerOrderDto> {
    this.assertNumber(number);
    const order = await this.db.order.findFirst({
      where: { number },
      include: { ...orderInclude, customer: { select: { id: true, phone: true, name: true } } },
    });
    if (!order) throw new NotFoundException('سفارش پیدا نشد');

    const payments = await this.db.payment.findMany({
      where: { orderId: order.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return { ...this.orders.toDto(order), customer: order.customer, payments: payments.map(toPaymentDto) };
  }

  // ───────────── تغییر وضعیت ─────────────
  async ship(number: number, trackingCode?: string): Promise<SellerOrderDto> {
    const order = await this.findBasic(number);
    // فقط PAID ← SHIPPED؛ غیر از آن، transition خطای ۴۰۹ می‌دهد
    await this.orders.transition(order.id, 'SHIPPED', { trackingCode });
    await this.notifications.orderShipped(this.ctx.require(), order.id);
    return this.get(number);
  }

  async cancel(number: number): Promise<SellerOrderDto> {
    const order = await this.findBasic(number);
    await this.orders.transition(order.id, 'CANCELED', { reason: CANCEL_REASON.SELLER });
    return this.get(number);
  }

  /** پرداخت خارج از درگاه (کارت‌به‌کارت، نقدی، ...) که فروشنده خودش تأیید می‌کند */
  async markPaid(number: number, reference?: string): Promise<SellerOrderDto> {
    const tenantId = this.ctx.require();
    const order = await this.findBasic(number);
    if (order.status !== 'PENDING') {
      throw conflict('NOT_PAYABLE', 'این سفارش در انتظار پرداخت نیست');
    }

    await this.db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date(), expiresAt: null },
      });
      if (claimed.count !== 1) {
        throw conflict('NOT_PAYABLE', 'وضعیت سفارش هم‌زمان تغییر کرد');
      }

      await tx.payment.create({
        data: {
          tenantId,
          orderId: order.id,
          provider: 'MANUAL',
          amount: order.total,
          status: 'PAID',
          // یکتا به ازای هر سفارش: ثبت دوباره غیرممکن است
          authority: `manual-${order.id}`,
          refId: reference || null,
          verifiedAt: new Date(),
        },
      });
    });

    await this.notifications.orderPaid(tenantId, order.id);
    return this.get(number);
  }

  // ───────────── داخلی ─────────────
  private assertNumber(number: number) {
    if (!Number.isInteger(number) || number < 1 || number > MAX_INT) {
      throw new NotFoundException('سفارش پیدا نشد');
    }
  }

  private async findBasic(number: number) {
    this.assertNumber(number);
    const order = await this.db.order.findFirst({
      where: { number },
      select: { id: true, status: true, total: true },
    });
    if (!order) throw new NotFoundException('سفارش پیدا نشد');
    return order;
  }

  private searchFilter(raw?: string): Prisma.OrderWhereInput {
    const term = normalizePersian(normalizeDigits(raw ?? '')).slice(0, 100);
    if (!term) return {};

    const digits = term.replace(/\D/g, '');
    const or: Prisma.OrderWhereInput[] = [{ recipientName: { contains: term, mode: 'insensitive' } }];
    if (/^\d{1,9}$/.test(term)) or.push({ number: Number(term) });
    if (digits.length >= 4) {
      or.push({ recipientPhone: { contains: digits } });
      or.push({ customer: { is: { phone: { contains: digits } } } });
    }
    return { OR: or };
  }
}