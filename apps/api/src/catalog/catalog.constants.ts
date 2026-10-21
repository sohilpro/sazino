export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export const PRODUCT_SORTS = ['newest', 'oldest', 'price_asc', 'price_desc', 'title'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const MAX_PRICE = 2_000_000_000;
export const MAX_QUANTITY = 1_000_000;
export const MAX_VARIANTS_PER_PRODUCT = 50;
export const DEFAULT_VARIANT_TITLE = 'پیش‌فرض';