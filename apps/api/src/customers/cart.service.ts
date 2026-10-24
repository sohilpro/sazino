import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CartDto, CartItemDto } from '@myapp/shared-types';
import { isUniqueViolation } from '../common/prisma-errors';
import type { Prisma } from '../generated/prisma/client';
import { StorageService } from '../storage/storage.service';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { itemIssue, stockLimit } from './cart.rules';
import { MAX_LINE_QUANTITY } from './customers.constants';
import { hashToken, newToken } from './token';

export interface CartIdentity {
  customerId?: string;
  guestToken?: string;
}

const itemSelect = {
  quantity: true,
  variant: {
    select: {
      id: true,
      title: true,
      price: true,
      compareAtPrice: true,
      inventory: { select: { quantity: true, allowBackorder: true } },
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          images: {
            orderBy: { position: 'asc' },
            take: 1,
            select: { media: { select: { id: true, alt: true } } },
          },
        },
      },
    },
  },
} as const satisfies Prisma.CartItemSelect;

type ItemRow = Prisma.CartItemGetPayload<{ select: typeof itemSelect }>;

const emptyCart = (): CartDto => ({ items: [], itemCount: 0, subtotal: 0, hasIssues: false });

@Injectable()
export class CartService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly storage: StorageService,
  ) {}

  // ───────────── خواندن ─────────────
  async view(identity: CartIdentity): Promise<CartDto> {
    const cart = await this.find(identity);
    return cart ? this.build(cart.id) : emptyCart();
  }

  // ───────────── تغییر ─────────────
  async add(
    identity: CartIdentity,
    variantId: string,
    quantity: number,
  ): Promise<{ cart: CartDto; guestToken?: string }> {
    const tenantId = this.ctx.require();

    const limit = stockLimit((await this.loadActiveVariant(variantId)).inventory);
    if (limit <= 0) throw new ConflictException('این کالا فعلاً ناموجود است');

    const { cart, guestToken } = await this.ensureCart(identity);

    const existing = await this.db.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      select: { quantity: true },
    });
    const wanted = (existing?.quantity ?? 0) + quantity;
    if (wanted > limit) {
      throw new ConflictException(`حداکثر ${limit} عدد از این کالا قابل سفارش است`);
    }

    await this.db.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { tenantId, cartId: cart.id, variantId, quantity: wanted },
      update: { quantity: wanted },
    });

    return { cart: await this.build(cart.id), guestToken };
  }

  async setQuantity(identity: CartIdentity, variantId: string, quantity: number): Promise<CartDto> {
    const cart = await this.find(identity);
    if (!cart) throw new NotFoundException('این کالا در سبد شما نیست');

    if (quantity === 0) return this.remove(identity, variantId);

    const limit = stockLimit((await this.loadActiveVariant(variantId)).inventory);
    if (limit <= 0) throw new ConflictException('این کالا فعلاً ناموجود است');
    if (quantity > limit) {
      throw new ConflictException(`حداکثر ${limit} عدد از این کالا قابل سفارش است`);
    }

    const updated = await this.db.cartItem.updateMany({
      where: { cartId: cart.id, variantId },
      data: { quantity },
    });
    if (updated.count === 0) throw new NotFoundException('این کالا در سبد شما نیست');

    return this.build(cart.id);
  }

  async remove(identity: CartIdentity, variantId: string): Promise<CartDto> {
    const cart = await this.find(identity);
    if (!cart) return emptyCart();
    await this.db.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    return this.build(cart.id);
  }

  async clear(identity: CartIdentity): Promise<CartDto> {
    const cart = await this.find(identity);
    if (cart) await this.db.cartItem.deleteMany({ where: { cartId: cart.id } });
    return emptyCart();
  }

  /** هنگام ورود: سبد مهمان را به سبد مشتری منتقل یا ادغام می‌کند */
  async mergeGuestCart(customerId: string, guestToken: string | undefined): Promise<void> {
    if (!guestToken) return;
    const tenantId = this.ctx.require();

    await this.db.$transaction(async (tx) => {
      const guest = await tx.cart.findFirst({
        where: { tokenHash: hashToken(guestToken), customerId: null },
        include: { items: true },
      });
      if (!guest) return;

      const mine = await tx.cart.findFirst({ where: { customerId }, select: { id: true } });
      if (!mine) {
        // مشتری سبدی نداشت: سبد مهمان همان‌جا به او می‌رسد
        await tx.cart.update({ where: { id: guest.id }, data: { customerId, tokenHash: null } });
        return;
      }

      for (const item of guest.items) {
        const existing = await tx.cartItem.findUnique({
          where: { cartId_variantId: { cartId: mine.id, variantId: item.variantId } },
          select: { quantity: true },
        });
        const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, MAX_LINE_QUANTITY);
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: mine.id, variantId: item.variantId } },
          create: { tenantId, cartId: mine.id, variantId: item.variantId, quantity },
          update: { quantity },
        });
      }
      await tx.cart.delete({ where: { id: guest.id } });
    });
  }

  // ───────────── داخلی ─────────────
  private find(identity: CartIdentity): Promise<{ id: string } | null> {
    if (identity.customerId) {
      return this.db.cart.findFirst({
        where: { customerId: identity.customerId },
        select: { id: true },
      });
    }
    if (identity.guestToken) {
      return this.db.cart.findFirst({
        where: { tokenHash: hashToken(identity.guestToken), customerId: null },
        select: { id: true },
      });
    }
    return Promise.resolve(null);
  }

  private async ensureCart(
    identity: CartIdentity,
  ): Promise<{ cart: { id: string }; guestToken?: string }> {
    const existing = await this.find(identity);
    if (existing) return { cart: existing };

    const tenantId = this.ctx.require();

    if (identity.customerId) {
      try {
        const cart = await this.db.cart.create({
          data: { tenantId, customerId: identity.customerId },
          select: { id: true },
        });
        return { cart };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        const again = await this.find(identity);
        if (!again) throw err;
        return { cart: again };
      }
    }

    const guestToken = newToken();
    const cart = await this.db.cart.create({
      data: { tenantId, tokenHash: hashToken(guestToken) },
      select: { id: true },
    });
    return { cart, guestToken };
  }

  /** کلاینت tenant: تنوع فروشگاه دیگر یا محصول غیرفعال پیدا نمی‌شود */
  private async loadActiveVariant(variantId: string) {
    const variant = await this.db.variant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        product: { select: { status: true } },
        inventory: { select: { quantity: true, allowBackorder: true } },
      },
    });
    if (!variant || variant.product.status !== 'ACTIVE') {
      throw new NotFoundException('این کالا در دسترس نیست');
    }
    return variant;
  }

  private async build(cartId: string): Promise<CartDto> {
    const tenantId = this.ctx.require();
    const rows = await this.db.cartItem.findMany({
      where: { cartId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: itemSelect,
    });

    const items = rows.map((row) => this.toItemDto(tenantId, row));
    return {
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((sum, i) => (i.issue ? sum : sum + i.lineTotal), 0),
      hasIssues: items.some((i) => i.issue !== null),
    };
  }

  private toItemDto(tenantId: string, row: ItemRow): CartItemDto {
    const { variant } = row;
    const media = variant.product.images[0]?.media;
    const limit = stockLimit(variant.inventory);

    return {
      variantId: variant.id,
      productId: variant.product.id,
      productSlug: variant.product.slug,
      productTitle: variant.product.title,
      variantTitle: variant.title,
      imageUrl: media ? this.storage.imageUrls(tenantId, media.id).thumb : null,
      imageAlt: media?.alt ?? null,
      // قیمت همیشه از تنوع خوانده می‌شود، نه از چیزی که قبلاً ذخیره شده
      unitPrice: variant.price,
      compareAtPrice: variant.compareAtPrice,
      quantity: row.quantity,
      lineTotal: variant.price * row.quantity,
      maxQuantity: limit,
      issue: itemIssue({ productStatus: variant.product.status, quantity: row.quantity, limit }),
    };
  }
}