export const DEFAULT_PRIMARY_COLOR = '#4f46e5';
export const MAX_DESCRIPTION_LENGTH = 500;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParsedStoreSettings {
  primaryColor: string;
  description: string | null;
  logoMediaId: string | null;
}

/**
 * ستون settings یک JSON آزاد است؛ هر مقدار هنگام خواندن اعتبارسنجی می‌شود.
 * رنگ مستقیم در HTML ویترین تزریق می‌شود، پس فقط #rrggbb پذیرفته می‌شود.
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

  return { primaryColor, description, logoMediaId };
}