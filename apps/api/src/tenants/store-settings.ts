export const DEFAULT_PRIMARY_COLOR = '#4f46e5';
export const MAX_DESCRIPTION_LENGTH = 500;

/**
 * فهرست مجاز فونت‌ها؛ باید با ویترین و پنل یکی باشد. مقدار ذخیره‌شده یک «کلید» ثابت است،
 * نه نام CSS. فعلاً فقط وزیرمتن (محلی، از پکیج vazirmatn).
 */
export const STORE_FONTS = ['vazirmatn'] as const;
export type StoreFontKey = (typeof STORE_FONTS)[number];
export const DEFAULT_FONT: StoreFontKey = 'vazirmatn';

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParsedStoreSettings {
  primaryColor: string;
  description: string | null;
  logoMediaId: string | null;
  font: StoreFontKey;
}

/**
 * ستون settings یک JSON آزاد است؛ هر مقدار هنگام خواندن اعتبارسنجی می‌شود.
 * رنگ و فونت مستقیم در HTML ویترین می‌روند، پس فقط مقدارهای مجاز پذیرفته می‌شوند.
 */
export function parseStoreSettings(raw: unknown): ParsedStoreSettings {
  const s =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const primaryColor =
    typeof s.primaryColor === 'string' && HEX_COLOR.test(s.primaryColor)
      ? s.primaryColor.toLowerCase()
      : DEFAULT_PRIMARY_COLOR;

  const description =
    typeof s.description === 'string' && s.description.trim()
      ? s.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
      : null;

  const logoMediaId =
    typeof s.logoMediaId === 'string' && UUID.test(s.logoMediaId) ? s.logoMediaId : null;

  const font =
    typeof s.font === 'string' && (STORE_FONTS as readonly string[]).includes(s.font)
      ? (s.font as StoreFontKey)
      : DEFAULT_FONT;

  return { primaryColor, description, logoMediaId, font };
}