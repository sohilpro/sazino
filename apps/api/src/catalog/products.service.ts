import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated, ProductDto } from '@myapp/shared-types';
import { buildMeta, type PaginationQueryDto } from '../common/pagination';
import { isUniqueViolation } from '../common/prisma-errors';
import { pickUniqueSlug, slugRoot } from '../common/slug';
import type { Prisma } from '../generated/prisma/client';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import {
  DEFAULT_VARIANT_TITLE,
  MAX_VARIANTS_PER_PRODUCT,
  type ProductSort,
} from './catalog.constants';
import { toProductDto } from './catalog.mapper';
import type {
  CreateProductDto,
  CreateVariantDto,
  ProductListQueryDto,
  StorefrontProductQueryDto,
  UpdateInventoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './product.dto';
import { StorageService } from '../storage/storage.service';

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    orderBy: { position: 'asc' },
    include: { inventory: { select: { quantity: true, allowBackorder: true } } },
  },
  images: {
    orderBy: { position: 'asc' },
    select: {
      tenantId: true,
      media: { select: { id: true, alt: true, width: true, height: true } },
    },
  },
} as const satisfies Prisma.ProductInclude;

const ORDER_BY = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  price_asc: [{ minPrice: 'asc' }, { id: 'asc' }],
  price_desc: [{ minPrice: 'desc' }, { id: 'desc' }],
  title: [{ title: 'asc' }, { id: 'asc' }],
} as const;

type Tx = Pick<TenantDb, 'variant' | 'product'>;

@Injectable()
export class ProductsService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly storage: StorageService,
  ) {}

  private dtoOptions(exposeStock: boolean) {
    return {
      exposeStock,
      imageUrls: (tenantId: string, mediaId: string) => this.storage.imageUrls(tenantId, mediaId),
    };
  }

  // ───────────── خواندن (پنل) ─────────────
  list(q: ProductListQueryDto): Promise<Paginated<ProductDto>> {
    const where: Prisma.ProductWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...this.searchFilter(q.q),
    };
    return this.paginate(where, q, q.sort, true);
  }

  async getById(id: string): Promise<ProductDto> {
    const row = await this.db.product.findUnique({ where: { id }, include: productInclude });
    if (!row) throw new NotFoundException('محصول پیدا نشد');
    return toProductDto(row, this.dtoOptions(true));
  }

  // ───────────── خواندن (ویترین) ─────────────
  listPublic(q: StorefrontProductQueryDto): Promise<Paginated<ProductDto>> {
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      ...(q.categorySlug
        ? {
            // دسته‌ی انتخاب‌شده یا زیرمجموعه‌هایش
            category: {
              is: {
                OR: [{ slug: q.categorySlug }, { parent: { is: { slug: q.categorySlug } } }],
              },
            },
          }
        : {}),
      ...this.searchFilter(q.q),
    };
    return this.paginate(where, q, q.sort, false);
  }

  async getPublicBySlug(slug: string): Promise<ProductDto> {
    const row = await this.db.product.findFirst({
      where: { slug: slug.trim().toLowerCase(), status: 'ACTIVE' },
      include: productInclude,
    });
    if (!row) throw new NotFoundException('محصول پیدا نشد');
    return toProductDto(row, this.dtoOptions(false));
  }

  // ───────────── ساخت و ویرایش محصول ─────────────
  async create(dto: CreateProductDto): Promise<ProductDto> {
    const tenantId = this.ctx.require();
    if (dto.categoryId) await this.assertCategory(dto.categoryId);
    this.assertVariantsValid(dto.variants);

    const prices = dto.variants.map((v) => v.price);

    for (let attempt = 0; ; attempt++) {
      const slug = dto.slug ?? (await this.generateSlug(dto.title));
      try {
        const id = await this.db.$transaction(async (tx) => {
          const product = await tx.product.create({
            data: {
              tenantId,
              title: dto.title,
              slug,
              description: dto.description ?? null,
              status: dto.status ?? 'DRAFT',
              categoryId: dto.categoryId ?? null,
              minPrice: Math.min(...prices),
              maxPrice: Math.max(...prices),
            },
          });

          for (const [position, v] of dto.variants.entries()) {
            const variant = await tx.variant.create({
              data: {
                tenantId,
                productId: product.id,
                title: v.title ?? DEFAULT_VARIANT_TITLE,
                sku: v.sku ?? null,
                price: v.price,
                compareAtPrice: v.compareAtPrice ?? null,
                position,
              },
            });
            await tx.inventory.create({
              data: {
                tenantId,
                variantId: variant.id,
                quantity: v.quantity ?? 0,
                allowBackorder: v.allowBackorder ?? false,
              },
            });
          }
          return product.id;
        });
        return await this.getById(id);
      } catch (err) {
        if (!dto.slug && attempt < 2 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDto> {
    const exists = await this.db.product.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('محصول پیدا نشد');
    if (dto.categoryId) await this.assertCategory(dto.categoryId);

    // slug هنگام تغییر عنوان عمداً ثابت می‌ماند (پایداری سئو)
    await this.db.product.update({
      where: { id },
      data: {
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
        status: dto.status,
        categoryId: dto.categoryId,
      },
    });
    return this.getById(id);
  }

  async remove(id: string): Promise<void> {
    const exists = await this.db.product.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('محصول پیدا نشد');
    // تنوع‌ها و موجودی توسط دیتابیس حذف می‌شوند (onDelete: Cascade)
    await this.db.product.delete({ where: { id } });
  }

  // ───────────── تصاویر ─────────────
  /** کل لیست تصاویر محصول را جایگزین می‌کند؛ ترتیب آرایه = ترتیب نمایش */
  async setImages(productId: string, mediaIds: string[]): Promise<ProductDto> {
    const tenantId = this.ctx.require();
    if (new Set(mediaIds).size !== mediaIds.length) {
      throw new BadRequestException('تصاویر تکراری است');
    }

    await this.db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!product) throw new NotFoundException('محصول پیدا نشد');

      if (mediaIds.length > 0) {
        // کلاینت tenant: تصویر فروشگاه دیگر اصلاً شمرده نمی‌شود
        const found = await tx.media.count({ where: { id: { in: mediaIds } } });
        if (found !== mediaIds.length) throw new BadRequestException('یک یا چند تصویر نامعتبر است');
      }

      await tx.productImage.deleteMany({ where: { productId } });
      if (mediaIds.length > 0) {
        await tx.productImage.createMany({
          data: mediaIds.map((mediaId, position) => ({ tenantId, productId, mediaId, position })),
        });
      }
    });

    return this.getById(productId);
  }

  // ───────────── تنوع‌ها ─────────────
  async addVariant(productId: string, dto: CreateVariantDto): Promise<ProductDto> {
    const tenantId = this.ctx.require();
    this.assertPricing(dto.price, dto.compareAtPrice);

    await this.db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!product) throw new NotFoundException('محصول پیدا نشد');

      const count = await tx.variant.count({ where: { productId } });
      if (count >= MAX_VARIANTS_PER_PRODUCT) {
        throw new ConflictException(`هر محصول حداکثر ${MAX_VARIANTS_PER_PRODUCT} تنوع دارد`);
      }

      const last = await tx.variant.aggregate({ where: { productId }, _max: { position: true } });
      const variant = await tx.variant.create({
        data: {
          tenantId,
          productId,
          title: dto.title ?? DEFAULT_VARIANT_TITLE,
          sku: dto.sku ?? null,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice ?? null,
          position: (last._max.position ?? -1) + 1,
        },
      });
      await tx.inventory.create({
        data: {
          tenantId,
          variantId: variant.id,
          quantity: dto.quantity ?? 0,
          allowBackorder: dto.allowBackorder ?? false,
        },
      });
      await this.syncPriceRange(tx, productId);
    });

    return this.getById(productId);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ): Promise<ProductDto> {
    await this.db.$transaction(async (tx) => {
      const variant = await tx.variant.findFirst({
        where: { id: variantId, productId },
        select: { id: true, price: true, compareAtPrice: true },
      });
      if (!variant) throw new NotFoundException('تنوع پیدا نشد');

      const price = dto.price ?? variant.price;
      const compareAt =
        dto.compareAtPrice === undefined ? variant.compareAtPrice : dto.compareAtPrice;
      this.assertPricing(price, compareAt);

      await tx.variant.update({
        where: { id: variantId },
        data: {
          title: dto.title,
          sku: dto.sku,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice,
          position: dto.position,
        },
      });
      await this.syncPriceRange(tx, productId);
    });

    return this.getById(productId);
  }

  async removeVariant(productId: string, variantId: string): Promise<ProductDto> {
    await this.db.$transaction(async (tx) => {
      const variant = await tx.variant.findFirst({
        where: { id: variantId, productId },
        select: { id: true },
      });
      if (!variant) throw new NotFoundException('تنوع پیدا نشد');

      const count = await tx.variant.count({ where: { productId } });
      if (count <= 1) throw new ConflictException('هر محصول باید حداقل یک تنوع داشته باشد');

      await tx.variant.delete({ where: { id: variantId } });
      await this.syncPriceRange(tx, productId);
    });

    return this.getById(productId);
  }

  async updateInventory(
    productId: string,
    variantId: string,
    dto: UpdateInventoryDto,
  ): Promise<ProductDto> {
    const tenantId = this.ctx.require();
    if (dto.quantity === undefined && dto.allowBackorder === undefined) {
      throw new BadRequestException('حداقل یکی از quantity یا allowBackorder لازم است');
    }

    const variant = await this.db.variant.findFirst({
      where: { id: variantId, productId },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('تنوع پیدا نشد');

    await this.db.inventory.update({
      where: { tenantId_variantId: { tenantId, variantId } },
      data: { quantity: dto.quantity, allowBackorder: dto.allowBackorder },
    });
    return this.getById(productId);
  }

  // ───────────── کمکی‌ها ─────────────
  private async paginate(
    where: Prisma.ProductWhereInput,
    q: PaginationQueryDto,
    sort: ProductSort | undefined,
    exposeStock: boolean,
  ): Promise<Paginated<ProductDto>> {
    const [rows, total] = await Promise.all([
      this.db.product.findMany({
        where,
        include: productInclude,
        orderBy: [...ORDER_BY[sort ?? 'newest']],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.db.product.count({ where }),
    ]);

    return {
      items: rows.map((r) => toProductDto(r, this.dtoOptions(exposeStock))),
      meta: buildMeta(q.page, q.limit, total),
    };
  }

  private searchFilter(q?: string): Prisma.ProductWhereInput {
    if (!q) return {};
    return {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
      ],
    };
  }

  private async assertCategory(categoryId: string) {
    // کلاینت tenant: دسته‌ی فروشگاه دیگر پیدا نمی‌شود
    const exists = await this.db.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException('دسته‌بندی نامعتبر است');
  }

  private assertPricing(price: number, compareAtPrice?: number | null) {
    if (compareAtPrice != null && compareAtPrice <= price) {
      throw new BadRequestException('قیمت قبل از تخفیف باید بیشتر از قیمت فروش باشد');
    }
  }

  private assertVariantsValid(variants: CreateVariantDto[]) {
    for (const v of variants) this.assertPricing(v.price, v.compareAtPrice);
    const skus = variants.map((v) => v.sku).filter((s): s is string => Boolean(s));
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('SKU تنوع‌ها باید یکتا باشد');
    }
  }

  private async syncPriceRange(tx: Tx, productId: string) {
    const agg = await tx.variant.aggregate({
      where: { productId },
      _min: { price: true },
      _max: { price: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: { minPrice: agg._min.price ?? 0, maxPrice: agg._max.price ?? 0 },
    });
  }

  private async generateSlug(title: string): Promise<string> {
    const root = slugRoot(title, 'product');
    const rows = await this.db.product.findMany({
      where: { slug: { startsWith: root } },
      select: { slug: true },
      take: 500,
    });
    return pickUniqueSlug(root, new Set(rows.map((r) => r.slug)));
  }
}
