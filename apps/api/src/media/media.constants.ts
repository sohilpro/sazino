export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** سقف تعداد پیکسل ورودی (محافظت در برابر decompression bomb) */
export const MAX_INPUT_PIXELS = 40_000_000;
export const MAX_PRODUCT_IMAGES = 10;

/** فرمت‌های مجاز ورودی؛ SVG عمداً حذف شده است */
export const ALLOWED_FORMATS = ['jpeg', 'png', 'webp', 'gif'] as const;

export const IMAGE_VARIANTS = {
  thumb: { width: 200, height: 200 },
  sm: { width: 480 },
  md: { width: 960 },
  lg: { width: 1600 },
} as const;

export type VariantName = keyof typeof IMAGE_VARIANTS;
export const VARIANT_NAMES = Object.keys(IMAGE_VARIANTS) as VariantName[];

export const IMAGE_CONTENT_TYPE = 'image/webp';
export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';