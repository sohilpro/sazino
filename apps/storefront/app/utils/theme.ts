export const DEFAULT_PRIMARY = '#4f46e5';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** فقط #rrggbb؛ هر مقدار دیگری به رنگ پیش‌فرض برمی‌گردد (دفاع دوم، قبل از تزریق در HTML) */
export function safeColor(value: unknown): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : DEFAULT_PRIMARY;
}

/** رنگ متن روی پس‌زمینه‌ی رنگی: سفید یا تقریباً سیاه، هرکدام که کنتراست بهتری دارد */
export function contrastColor(hex: string): string {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.179 ? '#111827' : '#ffffff';
}