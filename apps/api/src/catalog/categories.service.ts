import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CategoryDetailDto, CategoryDto } from '@myapp/shared-types';
import { isUniqueViolation } from '../common/prisma-errors';
import { pickUniqueSlug, slugRoot } from '../common/slug';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { toCategoryDto } from './catalog.mapper';
import type { CreateCategoryDto, UpdateCategoryDto } from './category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
  ) {}

  // ───────────── خواندن ─────────────
  /** پنل: همه‌ی دسته‌ها با تعداد همه‌ی محصولات */
  async list(): Promise<CategoryDto[]> {
    const rows = await this.db.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map((r) => toCategoryDto(r, r._count.products));
  }

  /** ویترین: فقط شمارش محصولات ACTIVE */
  async listPublic(): Promise<CategoryDto[]> {
    const rows = await this.db.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: { status: 'ACTIVE' } } } } },
    });
    return rows.map((r) => toCategoryDto(r, r._count.products));
  }

  async get(id: string): Promise<CategoryDto> {
    const row = await this.db.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!row) throw new NotFoundException('دسته‌بندی پیدا نشد');
    return toCategoryDto(row, row._count.products);
  }

  async getPublicBySlug(slug: string): Promise<CategoryDetailDto> {
    const row = await this.db.category.findFirst({
      where: { slug: slug.trim().toLowerCase() },
      include: {
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          include: { _count: { select: { products: { where: { status: 'ACTIVE' } } } } },
        },
      },
    });
    if (!row) throw new NotFoundException('دسته‌بندی پیدا نشد');

    return {
      category: toCategoryDto(row, row._count.products),
      parent: row.parent,
      children: row.children.map((c) => toCategoryDto(c, c._count.products)),
    };
  }

  // ───────────── نوشتن ─────────────
  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const tenantId = this.ctx.require();
    if (dto.parentId) await this.assertValidParent(dto.parentId);

    for (let attempt = 0; ; attempt++) {
      const slug = dto.slug ?? (await this.generateSlug(dto.name));
      try {
        const row = await this.db.category.create({
          data: {
            tenantId,
            parentId: dto.parentId ?? null,
            name: dto.name,
            slug,
            description: dto.description ?? null,
            position: dto.position ?? 0,
          },
        });
        return await this.get(row.id);
      } catch (err) {
        // رقابت هم‌زمان روی slug خودکار: دوباره slug جدید حساب کن
        if (!dto.slug && attempt < 2 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const current = await this.db.category.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new NotFoundException('دسته‌بندی پیدا نشد');

    if (dto.parentId) {
      await this.assertValidParent(dto.parentId, id);
      const childCount = await this.db.category.count({ where: { parentId: id } });
      if (childCount > 0) {
        throw new BadRequestException(
          'دسته‌بندی‌ای که زیرمجموعه دارد نمی‌تواند زیرمجموعه‌ی دسته‌ی دیگری شود',
        );
      }
    }

    await this.db.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        parentId: dto.parentId,
        description: dto.description,
        position: dto.position,
      },
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const row = await this.db.category.findUnique({
      where: { id },
      select: { id: true, _count: { select: { children: true } } },
    });
    if (!row) throw new NotFoundException('دسته‌بندی پیدا نشد');
    if (row._count.children > 0) {
      throw new ConflictException('ابتدا زیرمجموعه‌های این دسته‌بندی را حذف یا جابه‌جا کنید');
    }
    // محصولات این دسته توسط دیتابیس بدون دسته می‌شوند (onDelete: SetNull)
    await this.db.category.delete({ where: { id } });
  }

  // ───────────── کمکی‌ها ─────────────
  private async assertValidParent(parentId: string, selfId?: string) {
    if (parentId === selfId) {
      throw new BadRequestException('یک دسته‌بندی نمی‌تواند والد خودش باشد');
    }
    // کلاینت tenant: دسته‌ی فروشگاه دیگر اصلاً پیدا نمی‌شود
    const parent = await this.db.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new BadRequestException('دسته‌بندی والد پیدا نشد');
    if (parent.parentId) {
      throw new BadRequestException('حداکثر دو سطح دسته‌بندی پشتیبانی می‌شود');
    }
  }

  private async generateSlug(name: string): Promise<string> {
    const root = slugRoot(name, 'category');
    const rows = await this.db.category.findMany({
      where: { slug: { startsWith: root } },
      select: { slug: true },
      take: 500,
    });
    return pickUniqueSlug(root, new Set(rows.map((r) => r.slug)));
  }
}