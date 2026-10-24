import type { OrderStatus } from '@myapp/shared-types';

export const SORT_OPTIONS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'price_asc', label: 'ارزان‌ترین' },
  { value: 'price_desc', label: 'گران‌ترین' },
  { value: 'title', label: 'عنوان (الفبا)' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export const isSortValue = (value: string): value is SortValue =>
  SORT_OPTIONS.some((o) => o.value === value);

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  SHIPPED: 'ارسال‌شده',
  CANCELED: 'لغوشده',
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  SHIPPED: 'bg-sky-100 text-sky-700',
  CANCELED: 'bg-slate-200 text-slate-600',
};

export const CANCEL_REASON_LABEL: Record<string, string> = {
  CUSTOMER: 'لغو توسط شما',
  EXPIRED: 'پرداخت در مهلت مقرر انجام نشد',
  SELLER: 'لغو توسط فروشگاه',
};
