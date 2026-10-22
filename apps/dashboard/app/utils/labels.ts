import type { ProductStatus, UserRole } from '@myapp/shared-types';

export const ROLE_LABEL: Record<UserRole, string> = {
  OWNER: 'مالک',
  ADMIN: 'مدیر',
  EDITOR: 'ویراستار',
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: 'پیش‌نویس',
  ACTIVE: 'فعال',
  ARCHIVED: 'بایگانی',
};

export const PRODUCT_STATUS_CLASS: Record<ProductStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-amber-100 text-amber-700',
};

export const PRODUCT_STATUS_OPTIONS = (Object.keys(PRODUCT_STATUS_LABEL) as ProductStatus[]).map(
  (value) => ({ value, label: PRODUCT_STATUS_LABEL[value] }),
);

export const SORT_OPTIONS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'oldest', label: 'قدیمی‌ترین' },
  { value: 'price_asc', label: 'ارزان‌ترین' },
  { value: 'price_desc', label: 'گران‌ترین' },
  { value: 'title', label: 'عنوان (الفبا)' },
] as const;