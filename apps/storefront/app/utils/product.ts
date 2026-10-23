import type { CategoryDto, ProductDto, VariantDto } from '@myapp/shared-types';

export interface Discount {
  percent: number;
  compareAt: number;
}

export function variantDiscount(v: Pick<VariantDto, 'price' | 'compareAtPrice'>): Discount | null {
  if (!v.compareAtPrice || v.compareAtPrice <= v.price) return null;
  const percent = Math.round(((v.compareAtPrice - v.price) / v.compareAtPrice) * 100);
  return percent >= 1 ? { percent, compareAt: v.compareAtPrice } : null;
}

/** تخفیف روی ارزان‌ترین تنوع (اگر قیمت قبل از تخفیف دارد) */
export function discountInfo(p: ProductDto): Discount | null {
  const cheapest = p.variants.reduce<VariantDto | undefined>(
    (best, v) => (!best || v.price < best.price ? v : best),
    undefined,
  );
  return cheapest ? variantDiscount(cheapest) : null;
}

/**
 * دسته‌های اصلی‌ای که خودشان یا زیرمجموعه‌هایشان محصول فعال دارند.
 * (productCount در API فقط محصولات مستقیم هر دسته را می‌شمارد)
 */
export function visibleRootCategories(all: CategoryDto[]): CategoryDto[] {
  const rootsWithProducts = new Set(
    all.filter((c) => (c.productCount ?? 0) > 0).map((c) => c.parentId ?? c.id),
  );
  return all.filter((c) => !c.parentId && rootsWithProducts.has(c.id));
}