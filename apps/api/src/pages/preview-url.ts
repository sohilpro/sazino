import { HOME_SLUG } from './page.dto';

/** پیش‌نمایش پیش‌نویس عمداً زیر /preview است تا کش HTML هرگز آن را نگه نداشته باشد */
export function buildPreviewPath(slug: string, token: string): string {
  const base = slug === HOME_SLUG ? '/preview' : `/preview/p/${encodeURIComponent(slug)}`;
  return `${base}?preview=${encodeURIComponent(token)}`;
}