import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  CartDto,
  CheckoutQuoteDto,
  OrderDto,
  OrderStatus,
  OrderSummaryDto,
  Paginated,
} from '@myapp/shared-types';
import { conflict } from '../common/errors';
import { buildMeta, type PaginationQueryDto } from '../common/pagination';
import { isUniqueViolation } from '../common/prisma-errors';
import { CartService } from '../customers/cart.service';
import type { Prisma } from '../generated/prisma/client';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { AddressesService } from './addresses.service';
import type { CreateOrderDto } from './order.dto';
import { canTransition, restoresStock } from './order-status';
import {
  CANCEL_REASON,
  FIRST_ORDER_NUMBER,
  MAX_ORDER_TOTAL,
  MAX_PENDING_ORDERS,
  ORDER_PAYMENT_WINDOW_MINUTES,
} from './orders.constants';
import { computeTotals, type ShippingRule } from './pricing';
import { ShippingService } from './shipping.service';

const MAX_INT = 2_147_483_647;

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly carts: CartService,
    private readonly addresses: AddressesService,
    private readonly shipping: ShippingService,
  ) {}

  // ───────────── پیش‌نمایش مبلغ ─────────────
  async quote(customerId: string, shippingMethodId: string): Promise<CheckoutQuoteDto> {
    const method = await this.shipping.findActive(shippingMethodId);
    if (!method) throw new BadRequestException('روش ارسال نامعتبر است');

    const cart = await this.carts.view({ customerId });
    return this.toQuote(cart, method);
  }

  private toQuote(cart: CartDto, rule: ShippingRule): CheckoutQuoteDto {
    // کالاهای دارای مشکل (ناموجود، غیرفعال) در مبلغ حساب نمی‌شوند
    const totals = computeTotals(
      cart.items.filter((i) => !i.issue),
      rule,
    );
    return { itemCount: cart.itemCount, hasIssues: cart.hasIssues, ...totals };
  }

  // ───────────── ثبت سفارش ─────────────
  async create(customerId: string, dto: CreateOrderDto): Promise<OrderDto> {
    const tenantId = this.ctx.require();

    // تا آمدن job روز ۱۳: موجودی سفارش‌های منقضی‌شده‌ی همین فروشگاه آزاد می‌شود
    await this.releaseExpired();

    const pending = await this.db.order.count({ where: { customerId, status: 'PENDING' } });
    if (pending >= MAX_PENDING_ORDERS) {
      throw conflict(
        'PENDING_LIMIT',
        `شما ${MAX_PENDING_ORDERS} سفارش پرداخت‌نشده دارید؛ ابتدا آن‌ها را پرداخت یا لغو کنید`,
      );
    }

    // کلاینت tenant: نشانی یا روش ارسال فروشگاه دیگر هرگز پیدا نمی‌شود
    const address = await this.addresses.findOwned(customerId, dto.addressId);
    if (!address) throw new BadRequestException('نشانی تحویل نامعتبر است');
    const method = await this.shipping.findActive(dto.shippingMethodId);
    if (!method) throw new BadRequestException('روش ارسال نامعتبر است');

    // قیمت از روی تنوع‌ها و در سرور: چیزی از کلاینت پذیرفته نمی‌شود
    const cart = await this.carts.view({ customerId });
    if (cart.items.length === 0) throw new BadRequestException('سبد خرید خالی است');
    if (cart.hasIssues) {
      throw conflict('CART_ISSUES', 'برخی کالاهای سبد در دسترس نیستند؛ ابتدا سبد را اصلاح کنید');
    }

    const totals = computeTotals(cart.items, method);
    if (totals.total > MAX_ORDER_TOTAL) {
      throw conflict('TOTAL_TOO_LARGE', 'مبلغ سفارش بیش از سقف مجاز است');
    }
    if (dto.expectedTotal !== totals.total) {
      throw conflict('PRICE_CHANGED', 'مبلغ سفارش تغییر کرده است؛ مبلغ جدید را بررسی کنید', {
        total: totals.total,
      });
    }

    const number = await this.nextNumber();
    const expiresAt = new Date(Date.now() + ORDER_PAYMENT_WINDOW_MINUTES * 60_000);

    await this.db.$transaction(async (tx) => {
      // ۱) نگه‌داشتن موجودی (شرطی و اتمیک)
      for (const item of cart.items) {
        const reserved = await tx.inventory.updateMany({
          where: {
            variantId: item.variantId,
            OR: [{ quantity: { gte: item.quantity } }, { allowBackorder: true }],
          },
          data: { quantity: { decrement: item.quantity } },
        });
        if (reserved.count !== 1) {
          throw conflict('OUT_OF_STOCK', `موجودی «${item.productTitle}» کافی نیست`);
        }
      }

      // ۲) قیمت‌ها بین خواندن سبد و همین لحظه عوض نشده باشند
      const current = await tx.variant.findMany({
        where: { id: { in: cart.items.map((i) => i.variantId) } },
        select: { id: true, price: true },
      });
      const priceOf = new Map(current.map((v) => [v.id, v.price]));
      if (cart.items.some((i) => priceOf.get(i.variantId) !== i.unitPrice)) {
        throw conflict('PRICE_CHANGED', 'قیمت یکی از کالاها تغییر کرده است؛ دوباره تلاش کنید');
      }

      // ۳) سفارش و آیتم‌ها (با snapshot)
      const order = await tx.order.create({
        data: {
          tenantId,
          number,
          customerId,
          subtotal: totals.subtotal,
          shippingFee: totals.shippingFee,
          total: totals.total,
          shippingTitle: method.title,
          recipientName: address.recipientName,
          recipientPhone: address.recipientPhone,
          province: address.province,
          city: address.city,
          address: address.address,
          postalCode: address.postalCode,
          note: dto.note || null,
          expiresAt,
        },
        select: { id: true },
      });

      await tx.orderItem.createMany({
        data: cart.items.map((i) => ({
          tenantId,
          orderId: order.id,
          productId: i.productId,
          variantId: i.variantId,
          productSlug: i.productSlug,
          productTitle: i.productTitle,
          variantTitle: i.variantTitle,
          imageUrl: i.imageUrl,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
        })),
      });

      // ۴) سبد خالی می‌شود
      await tx.cartItem.deleteMany({ where: { cart: { is: { customerId } } } });
    });

    return this.getByNumber(customerId, number);
  }

  // ───────────── خواندن ─────────────
  async getByNumber(customerId: string, number: number): Promise<OrderDto> {
    if (!Number.isInteger(number) || number < 1 || number > MAX_INT) {
      throw new NotFoundException('سفارش پیدا نشد');
    }
    const order = await this.db.order.findFirst({
      where: { customerId, number },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    if (!order) throw new NotFoundException('سفارش پیدا نشد');
    return this.toDto(order);
  }

  async list(customerId: string, q: PaginationQueryDto): Promise<Paginated<OrderSummaryDto>> {
    const where = { customerId };
    const [rows, total] = await Promise.all([
      this.db.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { items: { select: { quantity: true, imageUrl: true }, orderBy: { id: 'asc' } } },
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
        thumbs: o.items.flatMap((i) => (i.imageUrl ? [i.imageUrl] : [])).slice(0, 3),
        createdAt: o.createdAt.toISOString(),
      })),
      meta: buildMeta(q.page, q.limit, total),
    };
  }

  // ───────────── تغییر وضعیت ─────────────
  async cancelByCustomer(customerId: string, number: number): Promise<OrderDto> {
    const order = await this.db.order.findFirst({
      where: { customerId, number },
      select: { id: true, status: true },
    });
    if (!order) throw new NotFoundException('سفارش پیدا نشد');
    if (order.status !== 'PENDING') {
      throw conflict('NOT_CANCELABLE', 'فقط سفارش در انتظار پرداخت قابل لغو است');
    }

    await this.transition(order.id, 'CANCELED', { reason: CANCEL_REASON.CUSTOMER });
    return this.getByNumber(customerId, number);
  }

  /**
   * تنها راه تغییر وضعیت (لغو مشتری، انقضا، و در روزهای بعد پرداخت و ارسال).
   * با WHERE status = قبلی «claim» می‌شود تا اجرای هم‌زمان یا تکراری فقط یک بار اثر کند.
   */
  async transition(
    orderId: string,
    to: OrderStatus,
    opts: { reason?: string; trackingCode?: string } = {},
  ): Promise<void> {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, items: { select: { variantId: true, quantity: true } } },
    });
    if (!order) throw new NotFoundException('سفارش پیدا نشد');
    if (!canTransition(order.status, to)) {
      throw conflict('BAD_TRANSITION', 'این تغییر وضعیت برای سفارش مجاز نیست');
    }

    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status: to,
          ...(to === 'PAID' ? { paidAt: now, expiresAt: null } : {}),
          ...(to === 'SHIPPED' ? { shippedAt: now, trackingCode: opts.trackingCode } : {}),
          ...(to === 'CANCELED'
            ? { canceledAt: now, cancelReason: opts.reason ?? null, expiresAt: null }
            : {}),
        },
      });
      if (claimed.count !== 1) {
        throw conflict('BAD_TRANSITION', 'وضعیت سفارش هم‌زمان تغییر کرد');
      }

      if (restoresStock(order.status, to)) {
        for (const item of order.items) {
          await tx.inventory.updateMany({
            where: { variantId: item.variantId },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }
    });
  }

  /** سفارش‌های پرداخت‌نشده‌ی منقضی را لغو و موجودی را آزاد می‌کند؛ تعداد آزادشده را برمی‌گرداند */
  async releaseExpired(limit = 20): Promise<number> {
    const stale = await this.db.order.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    let released = 0;
    for (const { id } of stale) {
      try {
        await this.transition(id, 'CANCELED', { reason: CANCEL_REASON.EXPIRED });
        released++;
      } catch (err) {
        // رقابت: دیگری (پرداخت یا لغو) همین الان وضعیت را عوض کرده؛ مشکلی نیست
        if (!(err instanceof HttpException)) {
          this.logger.warn(`Could not expire order ${id}: ${(err as Error).message}`);
        }
      }
    }
    return released;
  }

  // ───────────── داخلی ─────────────
  /** شماره‌ی بعدی سفارش این فروشگاه (ممکن است عددی هدر برود؛ ایرادی ندارد) */
  private async nextNumber(): Promise<number> {
    const tenantId = this.ctx.require();
    for (let attempt = 0; ; attempt++) {
      try {
        const row = await this.db.orderCounter.upsert({
          where: { tenantId },
          create: { tenantId, lastNumber: FIRST_ORDER_NUMBER },
          update: { lastNumber: { increment: 1 } },
          select: { lastNumber: true },
        });
        return row.lastNumber;
      } catch (err) {
        // اولین سفارش‌های هم‌زمان: یکی شمارنده را می‌سازد و دیگری دوباره تلاش می‌کند
        if (attempt < 2 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
  }

  private toDto(o: OrderWithItems): OrderDto {
    const iso = (d: Date | null) => (d ? d.toISOString() : null);
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      items: o.items.map((i) => ({
        productId: i.productId,
        productSlug: i.productSlug,
        productTitle: i.productTitle,
        variantTitle: i.variantTitle,
        sku: i.sku,
        imageUrl: i.imageUrl,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
      subtotal: o.subtotal,
      shippingFee: o.shippingFee,
      shippingTitle: o.shippingTitle,
      total: o.total,
      address: {
        recipientName: o.recipientName,
        recipientPhone: o.recipientPhone,
        province: o.province,
        city: o.city,
        address: o.address,
        postalCode: o.postalCode,
      },
      note: o.note,
      trackingCode: o.trackingCode,
      cancelReason: o.cancelReason,
      expiresAt: iso(o.expiresAt),
      createdAt: o.createdAt.toISOString(),
      paidAt: iso(o.paidAt),
      shippedAt: iso(o.shippedAt),
      canceledAt: iso(o.canceledAt),
    };
  }
}