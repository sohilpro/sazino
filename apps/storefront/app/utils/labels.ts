export const SORT_OPTIONS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'price_asc', label: 'ارزان‌ترین' },
  { value: 'price_desc', label: 'گران‌ترین' },
  { value: 'title', label: 'عنوان (الفبا)' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export const isSortValue = (value: string): value is SortValue =>
  SORT_OPTIONS.some((o) => o.value === value);