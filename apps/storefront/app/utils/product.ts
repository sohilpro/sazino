import type { ProductDto } from '@myapp/shared-types';

/** تخفیف روی ارزان‌ترین تنوع (اگر قیمت قبل از تخفیف دارد) */
export function discountInfo(p: ProductDto): { percent: number; compareAt: number } | null {
  const cheapest = p.variants.reduce<ProductDto['variants'][number] | undefined>(
    (best, v) => (!best || v.price < best.price ? v : best),
    undefined,
  );
  if (!cheapest?.compareAtPrice || cheapest.compareAtPrice <= cheapest.price) return null;

  return {
    percent: Math.round(((cheapest.compareAtPrice - cheapest.price) / cheapest.compareAtPrice) * 100),
    compareAt: cheapest.compareAtPrice,
  };
}