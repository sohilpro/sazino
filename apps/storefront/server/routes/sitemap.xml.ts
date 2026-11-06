import type { SitemapUrlsDto, StoreInfo } from '@myapp/shared-types';
import { apiFetch, upstreamStatus } from '../utils/api';
import { buildSitemapXml } from '../utils/sitemap';

export default defineEventHandler(async (event) => {
  let store: StoreInfo;
  let list: SitemapUrlsDto;
  try {
    store = await apiFetch<StoreInfo>(event, '/store');
    list = await apiFetch<SitemapUrlsDto>(event, '/storefront/sitemap-urls');
  } catch (error) {
    const status = upstreamStatus(error);
    // فروشگاه ناشناخته یا معلق = ۴۰۴؛ هر خطای دیگر موقتی است
    if (status !== undefined && status >= 400 && status < 500) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' });
    }
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' });
  }

  setResponseHeaders(event, {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=600, s-maxage=600',
    vary: 'Host',
  });
  return buildSitemapXml(store.canonicalUrl, list.urls);
});