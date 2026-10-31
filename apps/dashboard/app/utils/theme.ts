export const DEFAULT_PRIMARY = '#4f46e5';

/** فونت‌های مجاز؛ کلیدها باید با API و ویترین یکی باشد */
export const STORE_FONTS = [
  { key: 'Vazirmatn FD', label: 'وزیرمتن (پیش‌فرض)' },
//   { key: 'noto-sans-arabic', label: 'نوتو سنس عربی' },
//   { key: 'noto-naskh-arabic', label: 'نوتو نسخ' },
//   { key: 'noto-kufi-arabic', label: 'نوتو کوفی' },
] as const;
export type StoreFontKey = (typeof STORE_FONTS)[number]['key'];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = (value: string): boolean => HEX.test(value);

const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => linear(channel(hex, i)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** نسبت کنتراست WCAG بین دو رنگ (۱ تا ۲۱) */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** رنگ متن روی دکمه‌ی رنگی (همان منطق ویترین) */
export const contrastColor = (hex: string): string => (luminance(hex) > 0.179 ? '#111827' : '#ffffff');

/** تقریب رنگ متن‌های رنگی ویترین (۸۵٪ رنگ اصلی و ۱۵٪ سیاه) */
export function brandTextColor(hex: string): string {
  const part = (i: number) =>
    Math.round(channel(hex, i) * 255 * 0.85)
      .toString(16)
      .padStart(2, '0');
  return `#${part(1)}${part(3)}${part(5)}`;
}

/** رنگ به‌قدری روشن است که قیمت و لینک‌های رنگی روی سفید خوانا نیستند */
export const lowContrastOnWhite = (hex: string): boolean =>
  contrastRatio(brandTextColor(hex), '#ffffff') < 3;