import type { VariantDto } from '@myapp/shared-types';

/** ورودی‌های عددی به‌صورت متن نگه‌داری می‌شوند تا ارقام فارسی و فیلد خالی درست مدیریت شود */
export interface VariantForm {
  /** کلید یکتای سمت کلاینت (برای v-for) */
  key: string;
  /** وجود id یعنی تنوع در سرور ذخیره شده است */
  id?: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  quantity: string;
  allowBackorder: boolean;
}

export const MAX_PRICE = 2_000_000_000;
export const MAX_QUANTITY = 1_000_000;
export const MAX_VARIANTS = 50;
export const DEFAULT_VARIANT_TITLE = 'پیش‌فرض';

const DIGITS = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';

export function newKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `k${Date.now()}${Math.random().toString(16).slice(2)}`;
}

/** null = خالی، NaN = نامعتبر، در غیر این صورت عدد صحیح نامنفی */
export function parseIntField(raw: string): number | null {
  const s = raw
    .replace(/[۰-۹٠-٩]/g, (d) => String(DIGITS.indexOf(d) % 10))
    .replace(/[\s,٬،]/g, '');
  if (s === '') return null;
  return /^\d{1,10}$/.test(s) ? Number(s) : Number.NaN;
}

export function emptyVariant(): VariantForm {
  return {
    key: newKey(),
    title: '',
    sku: '',
    price: '',
    compareAtPrice: '',
    quantity: '0',
    allowBackorder: false,
  };
}

export function variantFromDto(v: VariantDto): VariantForm {
  return {
    key: newKey(),
    id: v.id,
    title: v.title,
    sku: v.sku ?? '',
    price: String(v.price),
    compareAtPrice: v.compareAtPrice === null ? '' : String(v.compareAtPrice),
    quantity: String(v.quantity ?? 0),
    allowBackorder: v.allowBackorder ?? false,
  };
}

/** پیام خطا یا null (قوانین هم‌راستا با DTOهای بکند) */
export function validateVariant(v: VariantForm): string | null {
  const price = parseIntField(v.price);
  if (price === null || Number.isNaN(price)) return 'قیمت را به‌صورت عدد صحیح وارد کنید';
  if (price > MAX_PRICE) return 'قیمت بیش از حد مجاز است';

  const compare = parseIntField(v.compareAtPrice);
  if (compare !== null && (Number.isNaN(compare) || compare > MAX_PRICE || compare <= price)) {
    return 'قیمت قبل از تخفیف باید عدد و بیشتر از قیمت فروش باشد';
  }

  const quantity = parseIntField(v.quantity);
  if (quantity !== null && (Number.isNaN(quantity) || quantity > MAX_QUANTITY)) {
    return 'موجودی باید عدد صحیح (حداکثر ۱٬۰۰۰٬۰۰۰) باشد';
  }

  if (v.title.trim().length > 100) return 'عنوان تنوع حداکثر ۱۰۰ کاراکتر است';
  if (v.sku.trim().length > 64) return 'SKU حداکثر ۶۴ کاراکتر است';
  return null;
}

export function toCreateVariantPayload(v: VariantForm) {
  return {
    title: v.title.trim() || undefined,
    sku: v.sku.trim() || undefined,
    price: parseIntField(v.price) as number,
    compareAtPrice: parseIntField(v.compareAtPrice) ?? undefined,
    quantity: parseIntField(v.quantity) ?? 0,
    allowBackorder: v.allowBackorder,
  };
}

export function toUpdateVariantPayload(v: VariantForm) {
  return {
    title: v.title.trim() || DEFAULT_VARIANT_TITLE,
    sku: v.sku.trim() || null,
    price: parseIntField(v.price) as number,
    compareAtPrice: parseIntField(v.compareAtPrice) ?? null,
  };
}

export function toInventoryPayload(v: VariantForm) {
  return {
    quantity: parseIntField(v.quantity) ?? 0,
    allowBackorder: v.allowBackorder,
  };
}